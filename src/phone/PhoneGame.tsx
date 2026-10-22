import { useEffect, useRef, useState } from 'react';
import { aiFight, LEVEL_NAMES, newMemory, nextAiStep, type AiMemory } from '../ai/brain';
import type { FightRecord } from '../battle/fight';
import { proposedOutcome } from '../battle/inGame';
import { TrainingDialog } from '../director/TrainingDialog';
import { activeTravel, copiesOf, travelCells, type TravelChoice } from '../director/travel';
import type { GameSession } from '../director/useGameSession';
import {
  cellMission,
  currentState,
  isRepeatInteraction,
  LASTING_MISSIONS,
  mustSendAway,
  nextLineIndex,
  rechargesStarter,
  stepBackCell,
  trainingRule,
  travelRule,
  type Game,
  type GameAction,
  type PlayerId,
} from '../engine';
import type { Overlay } from '../sync/liveView';
import { Stage } from '../ui/Stage';
import {
  blockReason,
  canUndoOnPhone,
  fightResults,
  moveTargets,
  phoneShowdownDue,
  quizRewards,
  retryChoice,
  rewardsDue,
  sendAwayChoices,
  showdownWinner,
} from './arbiter';
import { PhoneFight, type PhoneFightSetup } from './PhoneFight';
import { PhonePanel } from './PhonePanel';
import styles from './PhoneGame.module.css';

interface PhoneGameProps {
  session: GameSession;
  game: Game;
  /** «Menu»: back to the start page; the game stays saved. */
  onMenu(): void;
  /** After the winner's screen: the game is over and deleted (spec 052, 2.9). */
  onGameOver(next: 'menu' | 'newGame'): void;
}

/** An alert disappears after this time (spec 055, 2.2). */
const MESSAGE_MS = 2000;

/**
 * An alert of the phone, in the strip at the bottom of the map (spec 055,
 * 2.2): a refusal of the referee or a notification of the game.
 */
interface Notice {
  text: string;
  kind: 'refusal' | 'news';
  /** A new alert restarts the time, also with the same text. */
  id: number;
}

/**
 * The game without the browser's bar, where the browser allows it (spec 064,
 * 2.2): Android and tablets, on a touch. On the iPhone it does not exist: the
 * game opens full screen from the Home screen (D-093). Asked once.
 */
let fullScreen: 'not asked' | 'asked' | 'refused' = 'not asked';
function goFullScreen(): void {
  const page = document.documentElement;
  if (fullScreen !== 'not asked' || !document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }
  fullScreen = 'asked';
  // The browser may say no: the game stays as it is, and it is not asked again.
  page.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    fullScreen = 'refused';
  });
}

/** The target of a highlighted cell, in board units (1600 wide): about a fingertip on a phone. */
const TAP_RADIUS = 60;

/** The pause between two steps of the AI's turn (spec 053, 2.2). */
const AI_PAUSE_MS = 900;
/** A turn of the AI never takes more steps than this (spec 053, criterion 3). */
const AI_MAX_STEPS = 20;

/**
 * The game on the phone (spec 052; D-083, D-084, D-085): the map with a
 * narrow column, one player at a time, the phone passed at every turn. The
 * referee decides what can be done; rewards and fights apply by themselves.
 */
export function PhoneGame({ session, game, onMenu, onGameOver }: PhoneGameProps) {
  const state = currentState(game);
  const current = state.currentPlayer;
  const name = (player: PlayerId) => state.players[player].name;
  const overlay = session.overlay;
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);
  // One alert at a time: the new one takes the place of the old one.
  const setMessage = (text: string, kind: Notice['kind'] = 'refusal') => {
    noticeCount.current += 1;
    setNotice({ text, kind, id: noticeCount.current });
  };
  const [fight, setFight] = useState<PhoneFightSetup | null>(null);
  const [training, setTraining] = useState<string | null>(null);
  const [travel, setTravel] = useState<TravelChoice | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // «Ritenta una sfida persa» (spec 061, 2.1): the window with «Annulla» and «Conferma».
  const [retryOffer, setRetryOffer] = useState<{ nodeId: string; message: string; actions: GameAction[] } | null>(
    null,
  );
  // The character chosen to leave the team after the sixth (spec 061, 2.3).
  const [leaving, setLeaving] = useState<string | null>(null);
  // «Tocca a G2: passa il telefono» (spec 052, 2.8), and the winner of the showdown (2.9).
  const [passTo, setPassTo] = useState<PlayerId | null>(null);
  const [winner, setWinner] = useState<PlayerId | null>(null);

  // The AI opponent (spec 053): its turn goes one step at a time, «Salta» does the rest at once.
  const ai = game.opponent;
  const aiTurn = ai !== undefined && current === ai.player;
  const [aiSkip, setAiSkip] = useState(false);
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [aiFightView, setAiFightView] = useState<{ nodeId: string; record: FightRecord; team: string[] } | null>(
    null,
  );
  const [aiTick, setAiTick] = useState(0);
  const aiMemory = useRef<AiMemory>(newMemory());
  const aiLog = useRef<string[]>([]);
  const aiSteps = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = window.setTimeout(() => setNotice(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // The newest notification of the game (purchases, powers, missions) goes in
  // the strip; none in the AI's turn, which has its summary (spec 055, 2.2).
  const notifications = state.notifications;
  const seenNotifications = useRef(notifications.map((notification) => notification.id));
  useEffect(() => {
    const fresh = notifications.filter((notification) => !seenNotifications.current.includes(notification.id));
    seenNotifications.current = notifications.map((notification) => notification.id);
    const newest = fresh[fresh.length - 1];
    if (newest && !aiTurn) {
      setMessage(newest.text, 'news');
    }
    // setMessage only stores the alert.
  }, [notifications, aiTurn]);

  // An end of turn left a showdown due when the page closed: it opens again (spec 052, 2.9).
  const { setOverlay } = session;
  const showdownOpen = overlay?.kind === 'showdown';
  const due = phoneShowdownDue(state) && state.actions.used === 0 && game.history.length > 1;
  useEffect(() => {
    if (due && !showdownOpen && !passTo && !aiSummary) {
      setOverlay({ kind: 'showdown' });
    }
  }, [due, showdownOpen, passTo, aiSummary, setOverlay]);

  /** The rewards of the missions that came true, at once (D-084). */
  const giveRewards = (from: Game) => {
    let latest = from;
    for (const reward of rewardsDue(currentState(latest))) {
      const next = session.perform(reward);
      if (!next) {
        break;
      }
      latest = next;
      // Its notification is the alert; in the AI's turn it goes in the summary (spec 055, 2.2).
      const done = currentState(next);
      const news = done.notifications[done.notifications.length - 1];
      if (ai && done.currentPlayer === ai.player && news) {
        const prefix = `${name(ai.player)} · `;
        aiLog.current.push(news.text.startsWith(prefix) ? news.text.slice(prefix.length) : news.text);
      }
    }
  };

  /**
   * An action of the player, if the referee allows it; then the rewards it
   * made due. `from` is the game to check when actions follow one another
   * before the next render.
   */
  const attempt = (action: GameAction, from: Game = game): Game | null => {
    const reason = blockReason(from, action);
    if (reason) {
      setMessage(reason);
      return null;
    }
    // The end of a turn with actions left was already asked inside the phone (spec 052, 2.8).
    const next = session.perform(action, { alreadyShown: ['actionsLeft'] });
    if (next) {
      giveRewards(next);
    }
    return next;
  };

  /** Results the referee decided (quiz, fight): no checks, then the rewards they made due. */
  const apply = (actions: GameAction[]) => {
    let latest: Game | null = null;
    for (const action of actions) {
      latest = session.perform(action) ?? latest;
    }
    if (latest) {
      giveRewards(latest);
    }
  };

  /**
   * An action of the AI: silent when the referee refuses it, which ends its
   * turn. Its line goes in the summary before the rewards it made due.
   */
  const aiAttempt = (action: GameAction, text?: string): Game | null => {
    if (blockReason(gameRef.current, action)) {
      return null;
    }
    const next = session.perform(action, { alreadyShown: ['actionsLeft'] });
    if (next) {
      gameRef.current = next;
      if (text) {
        aiLog.current.push(text);
      }
      giveRewards(next);
    }
    return next;
  };

  // A new turn of the AI: a fresh memory, an empty summary.
  const turn = state.turn;
  useEffect(() => {
    if (aiTurn) {
      aiMemory.current = newMemory();
      aiLog.current = [];
      aiSteps.current = 0;
      setAiSkip(false);
    }
  }, [aiTurn, turn]);

  const finishAiFight = (view: { nodeId: string; record: FightRecord; team: string[] }) => {
    if (!ai) {
      return;
    }
    const cellState = currentState(gameRef.current);
    const mission = cellMission(cellState.cells[view.nodeId]);
    const won = proposedOutcome(view.record, mission) !== 'lost';
    aiLog.current.push(won ? '… e vince: il premio è suo' : '… e perde: nessun premio');
    apply(fightResults(view.record, mission, view.nodeId, ai.player, view.team));
    setAiFightView(null);
    setOverlay(null);
    setAiTick((tick) => tick + 1);
  };

  const endAiTurn = () => {
    setOverlay(null);
    aiAttempt({ type: 'endTurn' });
    setAiSummary(aiLog.current.length > 0 ? [...aiLog.current] : ['Non fa niente e passa il turno']);
  };

  /** One step of the AI's turn (spec 053, 2.2). */
  const runAiStep = () => {
    if (!ai) {
      return;
    }
    const latest = gameRef.current;
    const latestState = currentState(latest);
    aiSteps.current += 1;
    const step =
      aiSteps.current > AI_MAX_STEPS
        ? ({ kind: 'end', text: '' } as const)
        : nextAiStep(latest, ai.level, Math.random, aiMemory.current);
    const memory = aiMemory.current;
    switch (step.kind) {
      case 'act':
        if (step.shop) {
          setOverlay({ kind: 'shop', nodeId: step.shop });
        } else if (session.overlay?.kind === 'shop') {
          setOverlay(null);
        }
        if (step.resolves) {
          memory.resolved.add(step.resolves);
        }
        if (step.reopens) {
          // «Ritenta»: the scene of that cell is to be dealt with again (spec 063, 2.4).
          memory.resolved.delete(step.reopens);
        }
        if (!aiAttempt(step.action, step.text)) {
          endAiTurn();
          return;
        }
        break;
      case 'interact':
        if (aiAttempt({ type: 'interact', nodeId: step.nodeId }, step.text)) {
          setOverlay({ kind: 'challenge', nodeId: step.nodeId, line: 0 });
        } else {
          endAiTurn();
          return;
        }
        break;
      case 'quiz': {
        memory.resolved.add(step.resolves);
        const mission = cellMission(latestState.cells[step.nodeId]);
        setOverlay({ kind: 'challenge', nodeId: step.nodeId, line: 0, answer: step.answer });
        const right = mission?.quiz?.correct === step.answer;
        aiLog.current.push(`${step.text}: ${right ? 'giusto, il premio è suo' : 'sbagliato'}`);
        apply(quizRewards(mission, step.answer, step.nodeId, ai.player));
        break;
      }
      case 'fight': {
        memory.resolved.add(step.resolves);
        aiLog.current.push(step.text);
        const decided = aiFight(latest, latestState, step.nodeId, step.fighters, Math.random);
        const view = { nodeId: step.nodeId, ...decided };
        if (aiSkip) {
          finishAiFight(view);
        } else {
          setAiFightView(view);
        }
        break;
      }
      case 'close':
        memory.resolved.add(step.resolves);
        setOverlay(null);
        break;
      case 'end':
        endAiTurn();
        return;
    }
    setAiTick((tick) => tick + 1);
  };

  const aiBusy = aiTurn && !aiFightView && !aiSummary && !winner && !showdownOpen && !fight;
  useEffect(() => {
    if (!aiBusy) {
      return undefined;
    }
    const timer = window.setTimeout(runAiStep, aiSkip ? 0 : AI_PAUSE_MS);
    return () => window.clearTimeout(timer);
    // One step per tick: runAiStep reads the latest game from gameRef.
  }, [aiBusy, aiTick, aiSkip]);

  const skipAiTurn = () => {
    setAiSkip(true);
    if (aiFightView) {
      finishAiFight(aiFightView);
    }
  };

  const traveling = activeTravel(state, travel);
  const travelTargets = travelCells(game, state, travel);
  const targets = overlay || passTo || winner || aiTurn ? null : travelTargets ?? [...moveTargets(game, state)];

  const isShop = (nodeId: string) => game.map.nodes.find((node) => node.id === nodeId)?.type === 'shop';

  const goTo = (nodeId: string) => {
    if (traveling) {
      if (travelTargets?.includes(nodeId)) {
        if (attempt({ type: 'useItem', player: traveling.player, itemId: traveling.itemId, to: nodeId })) {
          setTravel(null);
        }
      } else {
        setMessage('Tocca una delle caselle evidenziate, o «Annulla» per non usarlo');
      }
      return;
    }
    if (nodeId === stepBackCell(game)) {
      // Back where the last move started: that move is undone (D-087).
      session.undo();
    } else if (moveTargets(game, state).has(nodeId)) {
      attempt({ type: 'move', to: nodeId });
    } else {
      setMessage('La pedina va solo sulle caselle evidenziate');
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (state.players[current].position !== nodeId) {
      goTo(nodeId);
      return;
    }
    if (traveling) {
      setMessage('La pedina è già qui: tocca un\'altra casella evidenziata');
      return;
    }
    if (isShop(nodeId)) {
      // Entering the shop uses no action (spec 002, section 4).
      setOverlay({ kind: 'shop', nodeId });
      return;
    }
    if (state.cells[nodeId]?.characterId === undefined) {
      return;
    }
    const open = () => setOverlay({ kind: 'challenge', nodeId, line: 0 });
    if (isRepeatInteraction(state, nodeId)) {
      open();
      return;
    }
    // A character who already beat the player (spec 061, 2.1; D-090).
    const retry = retryChoice(game, nodeId);
    if (retry?.kind === 'refused') {
      setMessage(retry.message);
    } else if (retry?.kind === 'offer') {
      setRetryOffer({ nodeId, message: retry.message, actions: retry.actions });
    } else if (attempt({ type: 'interact', nodeId })) {
      open();
    }
  };

  /** «Conferma»: the power (and the Senzu) first, then the challenge opens again. */
  const confirmRetry = () => {
    const offer = retryOffer;
    setRetryOffer(null);
    if (!offer) {
      return;
    }
    let latest = game;
    for (const action of [...offer.actions, { type: 'interact', nodeId: offer.nodeId } as const]) {
      const next = attempt(action, latest);
      if (!next) {
        return;
      }
      latest = next;
    }
    setOverlay({ kind: 'challenge', nodeId: offer.nodeId, line: 0 });
  };

  // After the sixth the player sends one away, never the starter (spec 061, 2.3; D-091).
  const sendingAway = (['p1', 'p2'] as const).find(
    (player) => player !== ai?.player && mustSendAway(state.players[player]),
  );
  const sendAway = () => {
    if (sendingAway && leaving) {
      apply([{ type: 'removeCharacter', player: sendingAway, characterId: leaving }]);
    }
    setLeaving(null);
  };
  const characterName = (characterId: string) =>
    game.catalog.find((character) => character.id === characterId)?.name ?? characterId;

  const handlePawnDrop = (player: PlayerId, nodeId: string) => {
    if (player !== current) {
      setMessage(`La pedina di ${name(player)} si muove nel suo turno`);
      return;
    }
    if (nodeId !== state.players[current].position) {
      goTo(nodeId);
    }
  };

  const closeOverlay = () => setOverlay(null);

  const answer = (index: number) => {
    if (overlay?.kind !== 'challenge' || overlay.answer !== undefined) {
      return;
    }
    const { nodeId } = overlay;
    setOverlay({ ...overlay, answer: index });
    apply(quizRewards(cellMission(state.cells[nodeId]), index, nodeId, current));
  };

  const nextLine = () => {
    if (overlay?.kind === 'challenge') {
      const count = state.cells[overlay.nodeId]?.lines?.length ?? 0;
      setOverlay({ ...overlay, line: nextLineIndex(overlay.line, count) });
    }
  };

  const challengeControls = (nodeId: string) => {
    const mission = cellMission(state.cells[nodeId]);
    const answered = overlay?.kind === 'challenge' ? overlay.answer : undefined;
    const accepted = (state.activeMissions ?? []).some(
      (active) => active.nodeId === nodeId && active.player === current,
    );
    const conquered = state.conquests[nodeId] !== undefined;
    return (
      <>
        {!mission && !conquered && (
          <button
            onClick={() => {
              if (attempt({ type: 'assign', nodeId, player: current })) {
                closeOverlay();
              }
            }}
          >
            Prendi in squadra
          </button>
        )}
        {mission?.type === 'fight' && !conquered && (
          <button onClick={() => setFight({ kind: 'mission', nodeId, player: current })}>Combatti</button>
        )}
        {mission?.type === 'quiz' && !conquered && answered === undefined && (
          <span>Tocca la risposta di {name(current)}.</span>
        )}
        {mission?.type === 'quiz' && answered !== undefined && (
          <span>
            {answered === mission.quiz?.correct
              ? `Giusto! Il premio va a ${name(current)}.`
              : 'Sbagliato: nessun premio, la casella resta libera.'}
          </span>
        )}
        {mission && LASTING_MISSIONS.includes(mission.type) && !conquered && !accepted && (
          <button
            onClick={() => {
              if (attempt({ type: 'acceptMission', nodeId, player: current })) {
                closeOverlay();
              }
            }}
          >
            Accetta
          </button>
        )}
        {mission?.type === 'other' && !conquered && (
          <button
            title="Sulla parola del giocatore: la missione è scritta a mano"
            onClick={() => {
              if (attempt({ type: 'completeMission', nodeId, player: current })) {
                closeOverlay();
              }
            }}
          >
            Completata
          </button>
        )}
      </>
    );
  };

  const useItem = (itemId: string) => {
    const item = game.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    if (trainingRule(item)) {
      setTraining(itemId);
    } else if (travelRule(item)) {
      if (state.actions.used >= state.actions.available) {
        setMessage(`${name(current)} ha già usato tutte le azioni del turno`);
        return;
      }
      setTravel({ player: current, itemId, turn: state.turn, copies: copiesOf(state, current, itemId) });
    } else if (rechargesStarter(item)) {
      attempt({ type: 'useItem', player: current, itemId });
    }
  };

  const endTurn = () => {
    setConfirmEnd(false);
    setTravel(null);
    closeOverlay();
    const next = attempt({ type: 'endTurn' });
    if (!next) {
      return;
    }
    const after = currentState(next);
    if (phoneShowdownDue(after)) {
      setOverlay({ kind: 'showdown' });
    } else if (!ai) {
      // Against the AI there is no phone to pass: its turn starts at once (spec 053, 2.2).
      setPassTo(after.currentPlayer);
    }
  };

  const askEndTurn = () => {
    const left = state.actions.available - state.actions.used;
    if (left > 0) {
      setConfirmEnd(true);
    } else {
      endTurn();
    }
  };

  const finishFight = (record: FightRecord, team: readonly string[]) => {
    const setup = fight;
    setFight(null);
    if (!setup) {
      return;
    }
    if (setup.kind === 'showdown') {
      setWinner(showdownWinner(record));
      closeOverlay();
      return;
    }
    apply(fightResults(record, cellMission(state.cells[setup.nodeId]), setup.nodeId, setup.player, team));
    closeOverlay();
  };

  if (winner) {
    return (
      <div className={styles.full}>
        <h1 className={styles.winner}>Vince {name(winner)}!</h1>
        <p>La partita è finita.</p>
        <div className={styles.buttons}>
          <button className={styles.primary} onClick={() => onGameOver('newGame')}>
            Nuova partita
          </button>
          <button onClick={() => onGameOver('menu')}>Menu iniziale</button>
        </div>
      </div>
    );
  }

  if (aiSummary) {
    return (
      <div className={styles.full}>
        <p className={styles.pass}>Turno dell'IA</p>
        <ul className={styles.summary}>
          {aiSummary.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <button className={styles.primary} onClick={() => setAiSummary(null)}>
            Tocca a te
          </button>
        </div>
      </div>
    );
  }

  if (passTo) {
    return (
      <div className={styles.full}>
        <p className={styles.pass}>
          Tocca a <strong className={styles[passTo]}>{name(passTo)}</strong>
        </p>
        <p>Passa il telefono.</p>
        <div className={styles.buttons}>
          <button className={styles.primary} onClick={() => setPassTo(null)}>
            Inizia il turno
          </button>
        </div>
      </div>
    );
  }

  const stageOverlay: Overlay | null = overlay;
  const panel = (playerId: PlayerId, side: 'left' | 'right') => (
    <PhonePanel
      playerId={playerId}
      side={side}
      state={state}
      catalog={game.catalog}
      items={game.items}
      canUndo={canUndoOnPhone(game)}
      locked={aiTurn}
      onUsePower={(powerId) => attempt({ type: 'usePower', player: current, powerId })}
      onUseItem={useItem}
      onAbandonMission={(missionId) => attempt({ type: 'abandonMission', missionId })}
      onEndTurn={askEndTurn}
      onUndo={() => {
        setTravel(null);
        session.undo();
      }}
      onMenu={onMenu}
    />
  );
  return (
    // The first touch anywhere closes the alert (spec 055, 2.2) and asks for the full screen (spec 064, 2.2).
    <div
      className={styles.game}
      onPointerDownCapture={() => {
        setNotice(null);
        goFullScreen();
      }}
    >
      {panel('p1', 'left')}
      <div className={styles.board}>
        <Stage
          map={game.map}
          catalog={game.catalog}
          items={game.items}
          state={state}
          overlay={stageOverlay}
          onNodeClick={aiTurn ? undefined : handleNodeClick}
          onNextLine={nextLine}
          onAnswer={aiTurn ? undefined : answer}
          hideRightAnswer
          onPawnDrop={aiTurn ? undefined : handlePawnDrop}
          highlighted={targets ? new Set(targets) : undefined}
          tapRadius={TAP_RADIUS}
          hideNotifications
          challengeControls={aiTurn ? () => <span>Turno dell'IA</span> : challengeControls}
          showdownControls={<button onClick={() => setFight({ kind: 'showdown' })}>Combatti</button>}
          shopActions={
            aiTurn
              ? undefined
              : (shopNodeId) => ({
                  buyCharacter: (characterId) => attempt({ type: 'buyCharacter', shopNodeId, characterId }),
                  buyItem: (itemId) => attempt({ type: 'buyItem', shopNodeId, itemId }),
                })
          }
          onCloseScene={aiTurn ? undefined : closeOverlay}
          onCloseShop={aiTurn ? undefined : closeOverlay}
          stackedShop
        />
        {aiTurn && ai && (
          <div className={styles.aiBanner} role="status">
            <span>Turno dell'IA · {LEVEL_NAMES[ai.level]}</span>
            <button onClick={skipAiTurn} disabled={aiSkip}>
              Salta
            </button>
          </div>
        )}
        {traveling && (
          <div className={styles.banner} role="status">
            <span>Tocca la casella dove va la pedina</span>
            <button onClick={() => setTravel(null)}>Annulla</button>
          </div>
        )}
        {notice && (
          <div
            className={`${styles.message} ${styles[notice.kind]} ${traveling ? styles.raised : ''}`}
            role="alert"
          >
            {notice.text}
          </div>
        )}
      </div>
      {panel('p2', 'right')}
      {confirmEnd && (
        <div className={styles.dialog} role="dialog" aria-modal="true">
          <div className={styles.dialogBox}>
            <p>
              {name(current)} ha ancora {state.actions.available - state.actions.used}{' '}
              {state.actions.available - state.actions.used === 1 ? 'azione' : 'azioni'}: finire il turno?
            </p>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={endTurn}>
                Fine turno
              </button>
              <button onClick={() => setConfirmEnd(false)}>Continua a giocare</button>
            </div>
          </div>
        </div>
      )}
      {retryOffer && (
        <div className={styles.dialog} role="dialog" aria-modal="true">
          <div className={styles.dialogBox}>
            <p>{retryOffer.message}</p>
            <div className={styles.buttons}>
              <button onClick={() => setRetryOffer(null)}>Annulla</button>
              <button className={styles.primary} onClick={confirmRetry}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
      {sendingAway && !fight && !aiFightView && (
        <div className={styles.dialog} role="dialog" aria-modal="true">
          <div className={styles.dialogBox}>
            <p>
              {name(sendingAway)} ha arruolato il sesto personaggio: chi lascia la squadra? Esce dalla partita.
            </p>
            <div className={styles.leaving}>
              {sendAwayChoices(state, sendingAway).map((characterId) => (
                <button
                  key={characterId}
                  className={characterId === leaving ? styles.primary : undefined}
                  aria-pressed={characterId === leaving}
                  onClick={() => setLeaving(characterId)}
                >
                  {characterName(characterId)}
                </button>
              ))}
            </div>
            <div className={styles.buttons}>
              <button className={styles.primary} disabled={!leaving} onClick={sendAway}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
      {aiFightView && ai && (
        <PhoneFight
          game={game}
          state={state}
          setup={{ kind: 'mission', nodeId: aiFightView.nodeId, player: ai.player }}
          preset={aiFightView}
          onSkip={skipAiTurn}
          onFinish={() => finishAiFight(aiFightView)}
          onCancel={() => finishAiFight(aiFightView)}
        />
      )}
      {fight && (
        <PhoneFight
          game={game}
          state={state}
          setup={fight}
          onFinish={finishFight}
          onCancel={() => setFight(null)}
        />
      )}
      {training && (
        <TrainingDialog
          game={game}
          state={state}
          player={current}
          itemId={training}
          onConfirm={(choices) => {
            if (attempt({ type: 'useTraining', player: current, itemId: training, choices })) {
              setTraining(null);
            }
          }}
          onClose={() => setTraining(null)}
        />
      )}
    </div>
  );
}

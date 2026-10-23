import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, fighterOf, recordFight, type FightRecord, type Side } from '../battle/fight';
import { charactersInGame, proposedMissionSides, proposedOutcome, showdownSides, teamChanges } from '../battle/inGame';
import type { BattleView, SideNames } from '../battle/playback';
import { BattleScreen } from '../battle/stream/BattleScreen';
import { usePlayback, type Speed } from '../battle/usePlayback';
import { cellMission, type Game, type GameState, type PlayerId } from '../engine';
import { Placeholder } from '../ui/Placeholder';
import styles from './PhoneFight.module.css';

/** «Combatti» in a fight mission or in the showdown (spec 052, 2.7 and 2.9). */
export type PhoneFightSetup = { kind: 'mission'; nodeId: string; player: PlayerId } | { kind: 'showdown' };

interface PhoneFightProps {
  game: Game;
  state: GameState;
  setup: PhoneFightSetup;
  /** «Continua» after the end: the referee applies the outcome (D-084). */
  onFinish(record: FightRecord, team: readonly string[]): void;
  /** Before the fight starts: back to the scene. */
  onCancel(): void;
  /**
   * A fight of the AI (spec 053, 2.2), already decided: it starts at once at
   * 2× and goes on by itself when it is over.
   */
  preset?: { record: FightRecord; team: readonly string[] };
  /** A fight of the AI: «Salta il turno» ends the AI's turn at once (spec 053, 2.2). */
  onSkip?: () => void;
  /** The showdown: two cards of a team, touched in turn, swap places (spec 089, as in the showdown window). */
  onSwap?: (player: PlayerId, a: number, b: number) => void;
}

/** After the end of a fight of the AI, the outcome stays on screen this long. */
const PRESET_PAUSE_MS = 1500;

const SPEEDS: Speed[] = [1, 2, 4];

/**
 * A simulated fight on the phone, full screen: who fights from the player's
 * team and in which order, then the fight animated as on the stream, then
 * the outcome, which applies by itself.
 */
export function PhoneFight({ game, state, setup, onFinish, onCancel, preset, onSkip, onSwap }: PhoneFightProps) {
  // As they were when «Combatti» was pressed: later changes do not touch the fight.
  const [frozen] = useState(() =>
    setup.kind === 'mission'
      ? proposedMissionSides(state, setup.nodeId, setup.player, game.catalog)
      : showdownSides(state),
  );
  // The showdown follows the teams: the order can still change before «Combatti» (spec 089).
  const live = useMemo(() => showdownSides(state), [state]);
  const initial = setup.kind === 'showdown' ? live : frozen;
  const [picked, setPicked] = useState<{ player: PlayerId; slot: number } | null>(null);
  const [team] = useState(() =>
    preset ? [...preset.team] : setup.kind === 'mission' ? [...state.players[setup.player].team] : [],
  );
  const [blocked] = useState(() => charactersInGame(state));
  const fighters = useMemo(() => {
    const found = new Map<string, NonNullable<ReturnType<typeof fighterOf>>>();
    for (const id of new Set([...team, ...initial.a, ...initial.b])) {
      const character = game.catalog.find((candidate) => candidate.id === id);
      const fighter = character ? fighterOf(character, game.catalog, blocked) : null;
      if (fighter) {
        found.set(id, fighter);
      }
    }
    return found;
  }, [game.catalog, blocked, team, initial]);

  // The player chooses as many as the format asks, among their characters that can fight.
  const candidates = team.filter((id) => fighters.has(id));
  const needed = Math.min(initial.a.length, candidates.length);
  const [chosen, setChosen] = useState<string[]>(() =>
    initial.a.filter((id) => fighters.has(id)).slice(0, needed),
  );
  const [record, setRecord] = useState<FightRecord | null>(preset?.record ?? null);
  const playback = usePlayback(record);
  const { restart, setSpeed } = playback;
  useEffect(() => {
    if (preset) {
      setSpeed(2);
      restart();
    }
    // Only once, when the fight of the AI opens: the playback functions change at every render.
  }, []);
  const finished = record !== null && playback.shown >= record.steps.length;
  useEffect(() => {
    if (!preset || !finished || !record) {
      return undefined;
    }
    const timer = window.setTimeout(() => onFinish(record, team), PRESET_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [preset, finished, record, team, onFinish]);

  const nameOf = (id: string | undefined) => game.catalog.find((character) => character.id === id)?.name ?? '';
  const mission = setup.kind === 'mission' ? cellMission(state.cells[setup.nodeId]) : undefined;
  const opponent = setup.kind === 'mission' ? nameOf(state.cells[setup.nodeId]?.characterId) : '';
  const names: SideNames =
    setup.kind === 'mission'
      ? { a: state.players[setup.player].name, b: opponent || 'Avversari' }
      : { a: state.players.p1.name, b: state.players.p2.name };

  /** The faces of a team of the showdown, touched in turn to swap places (spec 089). */
  const swapProps = (player: PlayerId) =>
    onSwap
      ? {
          picked: picked?.player === player ? picked.slot : null,
          onPick: (slot: number) => {
            if (picked?.player === player && picked.slot !== slot) {
              onSwap(player, picked.slot, slot);
              setPicked(null);
            } else {
              setPicked(picked?.player === player && picked.slot === slot ? null : { player, slot });
            }
          },
        }
      : {};

  const start = () => {
    const side = (ids: readonly string[]) => ids.flatMap((id) => fighters.get(id) ?? []);
    const sides: Record<Side, string[]> =
      setup.kind === 'mission' ? { a: chosen, b: initial.b } : { a: initial.a, b: initial.b };
    setRecord(recordFight({ a: side(sides.a), b: side(sides.b) }, DEFAULT_SETTINGS, Math.random));
    playback.restart();
  };

  if (!record) {
    if (setup.kind === 'showdown') {
      return (
        <div className={styles.chooseBackdrop}>
          <div className={`${styles.choose} ${styles.chooseDialog}`} role="dialog" aria-modal="true" aria-label="Showdown">
            <h2 className={styles.title}>Showdown</h2>
            <p className={styles.note}>
              Le due squadre al completo, nell'ordine in cui sono.
              {onSwap ? ' Tocca due personaggi della stessa squadra per scambiarli.' : ''} Chi vince lo showdown vince la
              partita.
            </p>
            <div className={styles.versus}>
              <Faces ids={initial.a} nameOf={nameOf} {...swapProps('p1')} />
              <span className={styles.vs}>VS</span>
              <Faces ids={initial.b} nameOf={nameOf} {...swapProps('p2')} />
            </div>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={start}>
                Combatti
              </button>
            </div>
          </div>
        </div>
      );
    }
    const toggle = (id: string) =>
      setChosen((current) =>
        current.includes(id)
          ? current.filter((other) => other !== id)
          : current.length < needed
            ? [...current, id]
            : current,
      );
    return (
      <div className={styles.chooseBackdrop}>
        <div className={`${styles.choose} ${styles.chooseDialog}`} role="dialog" aria-modal="true" aria-label="Scelta dei combattenti">
          <div className={styles.head}>
            <button onClick={onCancel}>← Indietro</button>
            <h2 className={styles.title}>
              Combattimento {mission?.format ?? '1v1'} · {opponent}
            </h2>
          </div>
          {needed === 0 ? (
            <p className={styles.note}>Nessun personaggio della squadra può combattere nel simulatore.</p>
          ) : (
            <p className={styles.note}>
              Tocca {needed === 1 ? 'chi manda' : `i ${needed} che manda`} in campo {names.a}, nell'ordine in
              cui combattono.
            </p>
          )}
          <ul className={styles.team}>
            {candidates.map((id) => {
              const position = chosen.indexOf(id);
              return (
                <li key={id}>
                  <button
                    className={position >= 0 ? `${styles.member} ${styles.picked}` : styles.member}
                    onClick={() => toggle(id)}
                    aria-pressed={position >= 0}
                  >
                    <Placeholder name={nameOf(id)} characterId={id} size="fill" />
                    {position >= 0 && <span className={styles.order}>{position + 1}</span>}
                    <span className={styles.memberName}>{nameOf(id)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>Contro:</p>
          <Faces ids={initial.b} nameOf={nameOf} />
          <div className={styles.buttons}>
            <button
              className={styles.primary}
              disabled={needed === 0 || chosen.length !== needed}
              onClick={start}
            >
              Combatti
            </button>
          </div>
        </div>
      </div>
    );
  }

  const view: BattleView = {
    record,
    shown: playback.shown,
    speed: playback.speed,
    switchRecharge: DEFAULT_SETTINGS.switchRecharge,
    names,
  };
  const over = playback.shown >= record.steps.length;
  return (
    <div className={styles.screen}>
      <div className={styles.arena}>
        <div className={styles.battle}>
          <BattleScreen view={view} />
        </div>
      </div>
      <div className={styles.controls}>
        {over ? (
          <>
            <span className={styles.outcome}>{outcomeText(record)}</span>
            <button className={styles.primary} onClick={() => onFinish(record, team)}>
              Continua
            </button>
          </>
        ) : (
          <>
            <button onClick={() => playback.setPlaying(!playback.playing)}>
              {playback.playing ? 'Pausa' : 'Riprendi'}
            </button>
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                className={playback.speed === speed ? styles.active : undefined}
                onClick={() => playback.setSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
            <button onClick={() => playback.jump(record.steps.length)}>Vai alla fine</button>
            {onSkip && <button onClick={onSkip}>Salta il turno</button>}
          </>
        )}
      </div>
    </div>
  );

  function outcomeText(fight: FightRecord): string {
    if (setup.kind === 'showdown') {
      return `Vince ${names[fight.winner]}!`;
    }
    const changes = teamChanges(fight, team);
    const transformed =
      changes.length > 0
        ? ` ${changes.map((change) => `${nameOf(change.from)} diventa ${nameOf(change.to)}`).join(', ')}.`
        : '';
    const result = {
      won: `Vince ${names.a}: il premio è suo.`,
      transformed: `${names.b} si è trasformato: il premio è di ${names.a}.`,
      lost:
        mission?.condition === 'transform'
          ? `${names.b} non si è trasformato: nessun premio.`
          : `Vince ${names.b}: nessun premio.`,
    }[proposedOutcome(fight, mission)];
    return result + transformed;
  }
}

function Faces({
  ids,
  nameOf,
  picked,
  onPick,
}: {
  ids: readonly string[];
  nameOf(id: string): string;
  /** The place chosen to swap, if any; `onPick` makes the faces touchable (the showdown). */
  picked?: number | null;
  onPick?: (slot: number) => void;
}) {
  return (
    <ul className={styles.faces}>
      {/* Henchmen may come twice (spec 069): the place tells them apart. */}
      {ids.map((id, index) => (
        <li
          key={`${id}-${index}`}
          className={`${styles.face} ${picked === index ? styles.facePicked : ''}`}
          onClick={onPick ? () => onPick(index) : undefined}
        >
          <Placeholder name={nameOf(id)} characterId={id} size="fill" />
        </li>
      ))}
    </ul>
  );
}

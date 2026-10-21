import { useMemo, useState } from 'react';
import type { FightRecord } from '../battle/fight';
import { charactersInGame, missionSides, proposedOutcome, showdownSides, teamChanges } from '../battle/inGame';
import pageStyles from '../battle/page/BattlePage.module.css';
import type { BattleView, SideNames } from '../battle/playback';
import { cellMission, type Game, type GameAction, type GameState, type PlayerId } from '../engine';
import { FightDialog } from './FightDialog';
import styles from './FightDialog.module.css';

/** Where "Simula" was pressed (spec 037, 2.4-2.5). */
export type FightSetup = { kind: 'mission'; nodeId: string; player: PlayerId } | { kind: 'showdown' };

interface GameFightProps {
  game: Game;
  state: GameState;
  setup: FightSetup;
  /** Applies an action of the game; null when it failed. */
  perform(action: GameAction): Game | null;
  onView(view: BattleView | null): void;
  /** "Persa": the challenge scene closes, as with the button of the scene. */
  onLost(): void;
  onClose(): void;
}

/**
 * "Simula" in a fight mission or in the showdown (spec 037, 2.4-2.5): the
 * teams of the game proposed, then the outcome proposed with the buttons of
 * the mission, and "Aggiorna la squadra" when the player's characters
 * transformed, even after a lost fight (D-060).
 */
export function GameFight({ game, state, setup, perform, onView, onLost, onClose }: GameFightProps) {
  // As they were when "Simula" was pressed: later clicks do not change the fight.
  const [initial] = useState(() =>
    setup.kind === 'mission' ? missionSides(state, setup.nodeId, setup.player) : showdownSides(state),
  );
  const [blocked] = useState(() => charactersInGame(state));
  const [team] = useState(() => (setup.kind === 'mission' ? state.players[setup.player].team : []));
  const [chosen, setChosen] = useState<'reward' | 'lost' | null>(null);
  const [updated, setUpdated] = useState(false);

  const nameOf = (id: string | undefined) => game.catalog.find((character) => character.id === id)?.name;
  const opponent = setup.kind === 'mission' ? nameOf(state.cells[setup.nodeId]?.characterId) : undefined;
  const playerName = setup.kind === 'mission' ? state.players[setup.player].name : undefined;
  const names = useMemo<SideNames>(
    () =>
      setup.kind === 'mission'
        ? { a: playerName ?? 'Giocatore', b: opponent ?? 'Avversari' }
        : { a: state.players.p1.name, b: state.players.p2.name },
    [setup.kind, playerName, opponent, state.players.p1.name, state.players.p2.name],
  );
  const mission = setup.kind === 'mission' ? cellMission(state.cells[setup.nodeId]) : undefined;
  const title =
    setup.kind === 'mission'
      ? `Combattimento ${mission?.format ?? '1v1'} · ${opponent ?? 'missione'}`
      : 'Showdown';

  const outcome = (record: FightRecord) => {
    if (setup.kind === 'showdown') {
      return (
        <p>
          Vince <strong>{names[record.winner]}</strong>. Cosa succede dopo lo decidi tu.
        </p>
      );
    }
    const proposal = proposedOutcome(record, mission);
    const transformMission = mission?.condition === 'transform';
    const proposalText = {
      won: `Vince ${names.a}: proposta «Vinta».`,
      transformed: `${names.b} si è trasformato: proposta «Si è trasformato».`,
      lost: transformMission
        ? `${names.b} non si è trasformato: proposta «Persa».`
        : `Vince ${names.b}: proposta «Persa».`,
    }[proposal];
    const changes = teamChanges(record, team);
    const changesText = changes.map((change) => `${nameOf(change.from)} → ${nameOf(change.to)}`).join(', ');
    return (
      <>
        <p>{proposalText}</p>
        <div className={pageStyles.actions}>
          <button
            type="button"
            className={proposal !== 'lost' ? pageStyles.primary : undefined}
            disabled={chosen !== null}
            title={`Il premio va a ${names.a}`}
            onClick={() => {
              if (perform({ type: 'completeMission', nodeId: setup.nodeId, player: setup.player })) {
                setChosen('reward');
              }
            }}
          >
            {transformMission ? 'Si è trasformato' : 'Vinta'}
          </button>
          <button
            type="button"
            className={proposal === 'lost' ? pageStyles.primary : undefined}
            disabled={chosen !== null}
            onClick={() => setChosen('lost')}
          >
            Persa
          </button>
          {changes.length > 0 && (
            <button
              type="button"
              disabled={updated}
              onClick={() => {
                if (perform({ type: 'transformCharacters', player: setup.player, changes })) {
                  setUpdated(true);
                }
              }}
            >
              {updated ? 'Squadra aggiornata ✓' : `Aggiorna la squadra: ${changesText}`}
            </button>
          )}
        </div>
        {chosen && (
          <p className={styles.note}>
            {chosen === 'reward'
              ? 'Premio dato.'
              : 'Nessun premio: chiudendo lo scontro si chiude anche la scena.'}
          </p>
        )}
      </>
    );
  };

  return (
    <FightDialog
      title={title}
      names={names}
      catalog={game.catalog}
      initial={initial}
      blocked={blocked}
      onView={onView}
      outcome={outcome}
      onClose={() => {
        if (chosen === 'lost') {
          onLost();
        }
        onClose();
      }}
    />
  );
}

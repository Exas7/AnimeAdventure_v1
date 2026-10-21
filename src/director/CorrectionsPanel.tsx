import { PLAYER_IDS, type GameAction, type GameState } from '../engine';
import { NumberField } from '../ui/NumberField';
import styles from './SidePanel.module.css';

interface CorrectionsPanelProps {
  state: GameState;
  perform(action: GameAction): void;
}

/** Manual corrections of turn values (spec 003, 2.10). Each change is logged and undoable. */
export function CorrectionsPanel({ state, perform }: CorrectionsPanelProps) {
  const { actions } = state;
  return (
    <div className={styles.form}>
      <label>
        Turno
        <NumberField
          label="Turno"
          value={state.turn}
          onCommit={(turn) => perform({ type: 'setTurn', turn })}
        />
      </label>
      <label>
        Tocca a
        <select
          value={state.currentPlayer}
          onChange={(event) =>
            perform({ type: 'setCurrentPlayer', player: event.target.value === 'p2' ? 'p2' : 'p1' })
          }
        >
          {PLAYER_IDS.map((playerId) => (
            <option key={playerId} value={playerId}>
              {state.players[playerId].name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Azioni usate
        <NumberField
          label="Azioni usate"
          value={actions.used}
          onCommit={(used) => perform({ type: 'setActions', actions: { used } })}
        />
      </label>
      <label>
        Azioni disponibili
        <NumberField
          label="Azioni disponibili"
          value={actions.available}
          onCommit={(available) => perform({ type: 'setActions', actions: { available } })}
        />
      </label>
      <label>
        Interazioni usate
        <NumberField
          label="Interazioni usate"
          value={actions.interactionsUsed}
          onCommit={(interactionsUsed) =>
            perform({ type: 'setActions', actions: { interactionsUsed } })
          }
        />
      </label>
      <label>
        Interazioni disponibili
        <NumberField
          label="Interazioni disponibili"
          value={actions.interactionsAvailable}
          onCommit={(interactionsAvailable) =>
            perform({ type: 'setActions', actions: { interactionsAvailable } })
          }
        />
      </label>
      {PLAYER_IDS.map((playerId) => (
        <label key={playerId}>
          Turni da saltare · {state.players[playerId].name}
          <NumberField
            label={`Turni da saltare di ${state.players[playerId].name}`}
            value={state.players[playerId].turnsToSkip}
            onCommit={(turns) => perform({ type: 'setTurnsToSkip', player: playerId, turns })}
          />
        </label>
      ))}
    </div>
  );
}

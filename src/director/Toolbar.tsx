import type { GameState } from '../engine';
import type { StreamLayout } from '../sync/liveView';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  state: GameState;
  canUndo: boolean;
  canRedo: boolean;
  layout: StreamLayout;
  onEndTurn(): void;
  onUndo(): void;
  onRedo(): void;
  onShowdown(): void;
  onSaveFile(): void;
  onLoadFile(file: File): void;
  onOpenStream(): void;
  onNewGame(): void;
  /** Back to the start screen; the game stays in progress (spec 010). */
  onOpenStartMenu(): void;
  /** Asks before closing and deleting the game in progress (spec 019). */
  onDiscardGame(): void;
  onLayoutChange(layout: StreamLayout): void;
  editMode: boolean;
  onToggleEditMode(): void;
}

export function Toolbar(props: ToolbarProps) {
  const { state } = props;
  const { actions } = state;
  const current = state.players[state.currentPlayer];
  // Guide for the host (spec 001, section 4): highlighted while actions remain.
  const actionsLeft = actions.used < actions.available;

  return (
    <header className={styles.toolbar}>
      <div className={`${styles.turn} ${styles[state.currentPlayer] ?? ''}`}>
        Turno {state.turn} · tocca a <strong>{current.name}</strong>
      </div>

      <div className={`${styles.counter} ${actionsLeft ? styles.counterOpen : ''}`}>
        Azioni {actions.used}/{actions.available} · Interazioni {actions.interactionsUsed}/
        {actions.interactionsAvailable}
      </div>

      <div className={styles.group}>
        <button className={styles.primary} onClick={props.onEndTurn}>
          Fine turno
        </button>
        {/* The same arrows as in the editors (spec 021). */}
        <button
          className={styles.arrow}
          onClick={props.onUndo}
          disabled={!props.canUndo}
          title="Annulla (Ctrl+Z)"
          aria-label="Annulla"
        >
          ↺
        </button>
        <button
          className={styles.arrow}
          onClick={props.onRedo}
          disabled={!props.canRedo}
          title="Ripeti (Ctrl+Y)"
          aria-label="Ripeti"
        >
          ↻
        </button>
        <button className={styles.showdown} onClick={props.onShowdown}>
          Showdown
        </button>
      </div>

      <div className={styles.group}>
        <button onClick={props.onSaveFile}>Salva su file</button>
        <label className={styles.fileButton}>
          Carica da file
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                props.onLoadFile(file);
              }
            }}
          />
        </label>
        <button onClick={props.onOpenStream}>Apri stream</button>
        <button onClick={props.onNewGame}>Nuova partita</button>
        <button onClick={props.onOpenStartMenu}>Menu iniziale</button>
      </div>

      <button
        className={`${styles.editToggle} ${props.editMode ? styles.editOn : ''}`}
        onClick={props.onToggleEditMode}
        aria-pressed={props.editMode}
        title="A modifica accesa il clic apre la modifica, visibile solo in regia"
      >
        Modifica: {props.editMode ? 'accesa' : 'spenta'}
      </button>

      <label className={styles.layout}>
        Pannelli sullo stream
        <select
          value={props.layout.playerPanels}
          onChange={(event) =>
            props.onLayoutChange({
              ...props.layout,
              playerPanels: event.target.value === 'hidden' ? 'hidden' : 'below',
            })
          }
        >
          <option value="below">sotto la mappa</option>
          <option value="hidden">nascosti</option>
        </select>
      </label>

      <button className={styles.discard} onClick={props.onDiscardGame}>
        Chiudi e cancella partita
      </button>
    </header>
  );
}

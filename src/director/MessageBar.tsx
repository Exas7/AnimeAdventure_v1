import type { Warning } from '../engine';
import styles from './MessageBar.module.css';

interface MessageBarProps {
  warnings: Warning[];
  /** Warnings of an off-rule move or interaction waiting for a second gesture (D-013). */
  pending?: Warning[];
  /** The pending action is a move: it is repeated by dropping the pawn again (D-026). */
  pendingIsMove?: boolean;
  error: string | null;
  onCloseError(): void;
  /** Information that stays until closed, e.g. what changed when an episode started. */
  notice?: string[];
  onCloseNotice?: () => void;
}

/**
 * Director-only messages: warnings of D-008 (never blocking) and errors
 * such as an unreadable file. They slide down over the screen without
 * moving the board, and let the mouse through to it (spec 016).
 */
export function MessageBar(props: MessageBarProps) {
  const { warnings, pending = [], error, onCloseError, notice = [] } = props;
  if (warnings.length === 0 && pending.length === 0 && !error && notice.length === 0) {
    return null;
  }
  return (
    <div className={styles.anchor}>
      <div className={styles.bar} aria-live="polite">
        {pending.length > 0 && (
          <div className={styles.pending}>
            {pending.map((warning) => (
              <p key={warning.kind}>⚠ {warning.message}</p>
            ))}
            <p className={styles.hint}>
              {props.pendingIsMove
                ? 'Trascina di nuovo la pedina sulla stessa casella per farlo comunque.'
                : 'Clicca di nuovo sullo stesso punto per farlo comunque.'}
            </p>
          </div>
        )}
        {error && (
          <p className={styles.error}>
            {error}
            <button onClick={onCloseError} aria-label="Chiudi messaggio">
              ×
            </button>
          </p>
        )}
        {notice.length > 0 && (
          <div className={styles.notice}>
            {notice.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <button onClick={props.onCloseNotice} aria-label="Chiudi messaggio">
              ×
            </button>
          </div>
        )}
        {warnings.map((warning, index) => (
          <p key={index} className={styles.warning}>
            ⚠ {warning.message}
          </p>
        ))}
      </div>
    </div>
  );
}

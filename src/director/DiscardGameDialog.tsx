import { useEffect } from 'react';
import { Frame, FrameTitle } from '../theme/Frame';
import styles from './DiscardGameDialog.module.css';

interface DiscardGameDialogProps {
  onCancel(): void;
  onConfirm(): void;
}

/**
 * Asks before deleting the game in progress (spec 019, D-030): the only
 * action that cannot be undone. Director window only.
 */
export function DiscardGameDialog({ onCancel, onConfirm }: DiscardGameDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <Frame
        danger
        className={styles.dialog}
        contentClassName={styles.content}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        onClick={(event) => event.stopPropagation()}
      >
        <FrameTitle id="discard-title">Sicuro di voler eliminare la partita?</FrameTitle>
        <p>
          La partita e il suo salvataggio automatico vengono cancellati e non si possono
          recuperare. Per tenerla, chiudi questo messaggio e usa prima "Salva su file".
        </p>
        <div className={styles.buttons}>
          <button autoFocus onClick={onCancel}>
            Annulla
          </button>
          <button className={styles.danger} onClick={onConfirm}>
            Torna al menu e cancella la partita
          </button>
        </div>
      </Frame>
    </div>
  );
}

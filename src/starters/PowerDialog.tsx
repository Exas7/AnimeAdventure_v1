import { useEffect } from 'react';
import { EMPTY_READY_POWER, ReadyPowerForm, type ReadyPowerDraft } from './ReadyPowerForm';
import styles from './PowerDialog.module.css';

interface PowerDialogProps {
  onSave(draft: ReadyPowerDraft): void;
  onClose(): void;
}

/** "Nuovo potere…" (spec 025, 2.3): the form of the list of powers, over the screen. */
export function PowerDialog({ onSave, onClose }: PowerDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Nuovo potere">
        <h2 className={styles.title}>Nuovo potere</h2>
        <p className={styles.note}>Entra nella lista dei poteri e va in questa proposta.</p>
        <ReadyPowerForm
          initial={EMPTY_READY_POWER}
          saveLabel="Aggiungi"
          onSave={onSave}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

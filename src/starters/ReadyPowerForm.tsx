import { useState } from 'react';
import { InfoButton } from '../ui/InfoButton';
import { PowerEditor } from './PowerEditor';
import { newPowerForm, type PowerForm } from './powerForm';
import styles from './ReadyPowerForm.module.css';

/** What the form edits: the text on the starter card and the effect behind it. */
export interface ReadyPowerDraft {
  cardText: string;
  effect: PowerForm;
}

export const EMPTY_READY_POWER: ReadyPowerDraft = {
  cardText: '',
  effect: newPowerForm('coinsEveryNTurns'),
};

interface ReadyPowerFormProps {
  initial: ReadyPowerDraft;
  saveLabel: string;
  onSave(draft: ReadyPowerDraft): void;
  onCancel(): void;
}

/** A power of the list (spec 025, 2.1): the card text and the effect of the catalog. */
export function ReadyPowerForm({ initial, saveLabel, onSave, onCancel }: ReadyPowerFormProps) {
  const [draft, setDraft] = useState<ReadyPowerDraft>(initial);
  return (
    <div className={styles.form}>
      <label>
        <span className={styles.labelRow}>
          Scritta della scheda
          <InfoButton label="Scritta della scheda">
            Si può scrivere {'{iniziali}'} e {'{totale}'}: in «Nuova partita» e nella scena della scelta
            diventano le monete iniziali della partita e le monete con cui parte chi sceglie questo
            starter. Per esempio «Parti con {'{totale}'} invece che {'{iniziali}'}» con 200 monete
            iniziali e 2.500 extra si legge «Parti con 2.700$ invece che 200$».
          </InfoButton>
        </span>
        <input
          value={draft.cardText}
          placeholder="Ogni 2 turni guadagni 200$"
          onChange={(event) => setDraft({ ...draft, cardText: event.target.value })}
        />
      </label>
      <span className={styles.label}>Effetto in partita</span>
      <PowerEditor power={draft.effect} onChange={(effect) => setDraft({ ...draft, effect })} />
      <div className={styles.buttons}>
        <button
          className={styles.primary}
          disabled={!draft.cardText.trim()}
          onClick={() => onSave(draft)}
        >
          {saveLabel}
        </button>
        <button onClick={onCancel}>Annulla</button>
      </div>
    </div>
  );
}

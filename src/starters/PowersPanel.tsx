import { useState } from 'react';
import screenStyles from '../director/Screens.module.css';
import { InfoButton } from '../ui/InfoButton';
import { describePower } from './powerForm';
import { EMPTY_READY_POWER, ReadyPowerForm, type ReadyPowerDraft } from './ReadyPowerForm';
import type { ReadyPower } from './readyPowers';
import styles from './PowersPanel.module.css';

interface PowersPanelProps {
  powers: ReadyPower[];
  onAdd(draft: ReadyPowerDraft): void;
  /** A new version takes the old one's place; episodes keep their copy (spec 025, 2.1). */
  onEdit(power: ReadyPower, draft: ReadyPowerDraft): void;
  onDelete(id: string): void;
}

/** "Poteri" in the episode library (spec 025, 2.1; D-037). */
export function PowersPanel({ powers, onAdd, onEdit, onDelete }: PowersPanelProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // Deleting asks for a second click on the same button, as for episodes.
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        Poteri
        <InfoButton label="Poteri">
          I poteri pronti da dare agli starter proposti: la scritta compare sulla scheda nella scena
          della scelta. Restano anche cambiando lista dei personaggi. Modificarne uno crea una versione
          nuova; le puntate già salvate tengono quella di prima.
        </InfoButton>
      </h2>

      {adding ? (
        <ReadyPowerForm
          initial={EMPTY_READY_POWER}
          saveLabel="Aggiungi"
          onSave={(draft) => {
            onAdd(draft);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className={styles.add} onClick={() => setAdding(true)}>
          Aggiungi potere
        </button>
      )}

      {powers.length === 0 ? (
        <p className={screenStyles.note}>Nessun potere.</p>
      ) : (
        <ul className={screenStyles.mapList}>
          {powers.map((power) =>
            editing === power.id ? (
              <li key={power.id} className={styles.editing}>
                <ReadyPowerForm
                  initial={{ cardText: power.cardText, effect: power.effect }}
                  saveLabel="Salva"
                  onSave={(draft) => {
                    onEdit(power, draft);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={power.id}>
                <div>
                  <strong>{power.cardText}</strong>
                  <span className={screenStyles.note}>{describePower(power.effect)}</span>
                </div>
                <div className={screenStyles.mapActions}>
                  <button onClick={() => setEditing(power.id)}>Modifica</button>
                  <button
                    className={deleteAsked === power.id ? screenStyles.danger : undefined}
                    onClick={() => {
                      if (deleteAsked === power.id) {
                        setDeleteAsked(null);
                        onDelete(power.id);
                      } else {
                        setDeleteAsked(power.id);
                      }
                    }}
                  >
                    {deleteAsked === power.id ? 'Clicca di nuovo per eliminare' : 'Elimina'}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

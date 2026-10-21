import { useState } from 'react';
import type { Character } from '../engine';
import screenStyles from '../director/Screens.module.css';
import { WHERE_TO_IMPORT_CATALOG } from '../director/startMenu';
import { InfoButton } from '../ui/InfoButton';
import { Placeholder } from '../ui/Placeholder';
import styles from './SpecialKeepersPanel.module.css';

interface SpecialKeepersPanelProps {
  /** The shopkeepers of the character list (D-034): shown, changed only in the list file. */
  listKeepers: Character[];
  keepers: Character[];
  onAdd(name: string, image: File): void;
  /** A new version replaces the old one; `image` is null to keep the picture. */
  onEdit(keeper: Character, name: string, image: File | null): void;
  onDelete(id: string): void;
}

interface Editing {
  id: string;
  name: string;
  image: File | null;
}

/**
 * "Negozianti" in the episode library (spec 029, 2.5): those of the
 * character list, to look at, and the special ones (spec 022, D-035).
 */
export function SpecialKeepersPanel(props: SpecialKeepersPanelProps) {
  const { listKeepers, keepers, onAdd, onEdit, onDelete } = props;
  const [name, setName] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  // Deleting asks for a second click on the same button, as for episodes.
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);

  const add = () => {
    if (name.trim() && image) {
      onAdd(name, image);
      setName('');
      setImage(null);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        Negozianti
        <InfoButton label="Negozianti">
          «Randomizza» dà a ogni negozio un negoziante diverso, scelto tra tutti quelli qui sotto.
        </InfoButton>
      </h2>

      <h3 className={styles.subtitle}>
        Dalla lista dei personaggi
        <InfoButton label="Negozianti della lista">
          Sono i personaggi con «sì» nella colonna «negoziante» della lista. Si cambiano nel file Excel
          della lista (docs/personaggi-bt3.xlsx), salvandolo come CSV e reimportandolo{' '}
          {WHERE_TO_IMPORT_CATALOG}.
        </InfoButton>
      </h3>
      {listKeepers.length === 0 ? (
        <p className={screenStyles.note}>Nessuno: la lista non ha la colonna «negoziante».</p>
      ) : (
        <ul className={styles.listKeepers}>
          {listKeepers.map((keeper) => (
            <li key={keeper.id}>
              <Placeholder name={keeper.name} characterId={keeper.id} />
              <span>{keeper.name}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.subtitle}>
        Speciali
        <InfoButton label="Negozianti speciali">
          Nome e immagine scelti da te: restano anche cambiando lista dei personaggi o gioco, e nei
          negozi compaiono nel menu «Negoziante»; «Randomizza» li sceglie come gli altri negozianti.
          Modificarne uno crea una versione nuova; le puntate già salvate tengono quella di prima.
        </InfoButton>
      </h3>

      <div className={styles.form}>
        <label>
          Nome
          <input
            value={name}
            placeholder="Nome del negoziante"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <ImageChoice file={image} label="Scegli immagine…" onChange={setImage} />
        <button className={styles.primary} disabled={!name.trim() || !image} onClick={add}>
          Aggiungi negoziante
        </button>
      </div>

      {keepers.length === 0 ? (
        <p className={screenStyles.note}>Nessun negoziante speciale.</p>
      ) : (
        <ul className={screenStyles.mapList}>
          {keepers.map((keeper) => {
            const open = editing?.id === keeper.id ? editing : null;
            return (
              <li key={keeper.id}>
                <div className={styles.who}>
                  <img className={styles.picture} src={keeper.imageData} alt={keeper.name} />
                  {open ? (
                    <input
                      value={open.name}
                      aria-label="Nome del negoziante"
                      onChange={(event) => setEditing({ ...open, name: event.target.value })}
                    />
                  ) : (
                    <strong>{keeper.name}</strong>
                  )}
                </div>
                <div className={screenStyles.mapActions}>
                  {open ? (
                    <>
                      <ImageChoice
                        file={open.image}
                        label="Nuova immagine…"
                        onChange={(file) => setEditing({ ...open, image: file })}
                      />
                      <button
                        disabled={!open.name.trim()}
                        onClick={() => {
                          onEdit(keeper, open.name, open.image);
                          setEditing(null);
                        }}
                      >
                        Salva
                      </button>
                      <button onClick={() => setEditing(null)}>Annulla</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing({ id: keeper.id, name: keeper.name, image: null })}>
                        Modifica
                      </button>
                      <button
                        className={deleteAsked === keeper.id ? screenStyles.danger : undefined}
                        onClick={() => {
                          if (deleteAsked === keeper.id) {
                            setDeleteAsked(null);
                            onDelete(keeper.id);
                          } else {
                            setDeleteAsked(keeper.id);
                          }
                        }}
                      >
                        {deleteAsked === keeper.id ? 'Clicca di nuovo per eliminare' : 'Elimina'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface ImageChoiceProps {
  file: File | null;
  label: string;
  onChange(file: File | null): void;
}

/** A button that opens the file picker and then shows the chosen file's name. */
function ImageChoice({ file, label, onChange }: ImageChoiceProps) {
  return (
    <label className={styles.fileButton}>
      {file ? file.name : label}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
    </label>
  );
}

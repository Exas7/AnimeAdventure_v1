import { useRef, useState, type ReactNode } from 'react';
import type { EpisodeSummary } from '../storage/episodeLibrary';
import { InfoButton } from '../ui/InfoButton';
import screenStyles from '../director/Screens.module.css';
import styles from './EpisodeLibraryScreen.module.css';

/** A map of the library an episode can start from. */
export interface MapOption {
  /** One of the maps that come with the app (D-045), not of the browser's library. */
  included?: boolean;
  id: string;
  name: string;
}

/** One library of the tab row: what it is, how many entries, and its page. */
export interface LibraryTab {
  id: string;
  label: string;
  count: number;
  /** Shown with a warning when empty and needed (e.g. no missions). */
  warn: boolean;
  content: ReactNode;
}

interface EpisodeLibraryScreenProps {
  episodes: EpisodeSummary[];
  /** "＋ Nuova puntata": the guided creation (spec 028, 3.3). */
  onNew(): void;
  onOpen(id: string): void;
  onExport(id: string): void;
  onImport(file: File): void;
  onDelete(id: string): void;
  onBack(): void;
  /** The libraries every episode uses: powers, special shopkeepers, missions, questions. */
  libraries: LibraryTab[];
}

/** The episodes and their libraries (spec 007, 2.1; spec 028, 3.2; D-019). */
export function EpisodeLibraryScreen(props: EpisodeLibraryScreenProps) {
  // Deleting asks for a second click on the same button (as in D-013).
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);
  const [tab, setTab] = useState(props.libraries[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = props.libraries.find((library) => library.id === tab) ?? props.libraries[0];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button onClick={props.onBack}>← Menu iniziale</button>
        <h1 className={screenStyles.title}>Puntate</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Le mie puntate
          <InfoButton label="Le puntate">
            Una puntata è una mappa con i personaggi già messi, i negozi e gli starter proposti, pronta
            per la diretta. Tiene una copia della mappa: se poi modifichi la mappa, la puntata resta
            com'era. «Esporta» la salva in un file da portare su un altro PC.
          </InfoButton>
        </h2>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={props.onNew}>
            ＋ Nuova puntata
          </button>
          <button onClick={() => fileRef.current?.click()}>Importa puntata</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                props.onImport(file);
              }
            }}
          />
        </div>

        {props.episodes.length === 0 ? (
          <p className={screenStyles.note}>Nessuna puntata: crea la prima con «＋ Nuova puntata».</p>
        ) : (
          <ul className={screenStyles.mapList}>
            {props.episodes.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.name}</strong>
                  <span className={screenStyles.note}>
                    mappa «{entry.mapName}» · {entry.filledCells}{' '}
                    {entry.filledCells === 1 ? 'casella' : 'caselle'} con personaggio · modificata il{' '}
                    {new Date(entry.updatedAt).toLocaleString('it-IT')}
                  </span>
                </div>
                <div className={screenStyles.mapActions}>
                  <button onClick={() => props.onOpen(entry.id)}>Apri</button>
                  <button onClick={() => props.onExport(entry.id)}>Esporta</button>
                  <button
                    className={deleteAsked === entry.id ? screenStyles.danger : undefined}
                    onClick={() => {
                      if (deleteAsked === entry.id) {
                        setDeleteAsked(null);
                        props.onDelete(entry.id);
                      } else {
                        setDeleteAsked(entry.id);
                      }
                    }}
                  >
                    {deleteAsked === entry.id ? 'Clicca di nuovo per eliminare' : 'Elimina'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Librerie
          <InfoButton label="Librerie">
            Valgono per tutte le puntate e restano anche cambiando lista dei personaggi. La creazione
            guidata di una puntata ti dice se ne manca qualcuna.
          </InfoButton>
        </h2>
        <div className={styles.tabs} role="tablist" aria-label="Librerie">
          {props.libraries.map((library) => (
            <button
              key={library.id}
              role="tab"
              aria-selected={library.id === shown?.id}
              className={library.id === shown?.id ? styles.activeTab : undefined}
              onClick={() => setTab(library.id)}
            >
              {library.label}
              <span className={`${styles.badge} ${library.warn ? styles.warnBadge : ''}`}>
                {library.count}
                {library.warn ? ' ⚠' : ''}
              </span>
            </button>
          ))}
        </div>
        <div role="tabpanel" className={styles.tabPanel}>
          {shown?.content}
        </div>
      </section>
    </div>
  );
}

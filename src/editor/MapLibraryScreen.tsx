import { useState } from 'react';
import type { IncludedMap } from '../included/includedMaps';
import type { MapSummary } from '../storage/mapLibrary';
import styles from '../director/Screens.module.css';

interface MapLibraryScreenProps {
  maps: MapSummary[];
  /** The maps that come with the app (D-045): to use, or to copy and change. */
  included: IncludedMap[];
  onCopyIncluded(id: string): void;
  onNew(): void;
  onOpen(id: string): void;
  onExport(id: string): void;
  onImport(file: File): void;
  onDelete(id: string): void;
  onBack(): void;
}

/** The map library in the browser (D-018). */
export function MapLibraryScreen(props: MapLibraryScreenProps) {
  // Deleting asks for a second click on the same button (as in D-013).
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Editor delle mappe</h1>
      <div className={styles.choices}>
        <button className={styles.primary} onClick={props.onNew}>
          Nuova mappa
        </button>
        <label className={styles.fileChoice}>
          Importa file
          <input
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
        </label>
        <button onClick={props.onBack}>← Indietro</button>
      </div>

      {props.included.length > 0 && <h2 className={styles.subtitle}>Le mie mappe</h2>}
      {props.maps.length === 0 ? (
        <p className={styles.note}>Nessuna mappa salvata.</p>
      ) : (
        <ul className={styles.mapList}>
          {props.maps.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.name}</strong>
                <span className={styles.note}>
                  {entry.cells} caselle{entry.hasBackground ? ', con sfondo' : ''} · modificata il{' '}
                  {new Date(entry.updatedAt).toLocaleString('it-IT')}
                </span>
              </div>
              <div className={styles.mapActions}>
                <button onClick={() => props.onOpen(entry.id)}>Apri</button>
                <button onClick={() => props.onExport(entry.id)}>Esporta file</button>
                <button
                  className={deleteAsked === entry.id ? styles.danger : undefined}
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

      {/* The maps that come with the app last (spec 033, 2.2). */}
      {props.included.length > 0 && (
        <>
          <h2 className={styles.subtitle}>Mappe base</h2>
          <p className={styles.note}>
            Vengono con l'app (cartella assets/maps/incluse) e si usano così come sono: per modificarne
            una, copiala in «Le mie mappe».
          </p>
          <ul className={styles.mapList}>
            {props.included.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.map.name}</strong>
                  <span className={styles.note}>
                    {entry.map.nodes.length} caselle{entry.map.background ? ', con sfondo' : ''}
                  </span>
                </div>
                <div className={styles.mapActions}>
                  <button onClick={() => props.onCopyIncluded(entry.id)}>Copia nelle mie mappe</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

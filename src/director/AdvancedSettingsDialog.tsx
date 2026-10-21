import type { CatalogSummary } from '../catalog/importCatalog';
import { Dialog } from '../ui/Dialog';
import { catalogFigures, NO_CATALOG } from './startMenu';
import styles from './AdvancedSettingsDialog.module.css';

interface AdvancedSettingsDialogProps {
  /** Summary of the character list in use, or null when there is none. */
  catalog: CatalogSummary | null;
  /** Opens the file picker of the character list. */
  onImportCatalog(): void;
  onClose(): void;
}

/**
 * "Impostazioni avanzate" of the start page (spec 042, 2.2): the features
 * that are ready but still on trial, marked "Beta" (D-068).
 */
export function AdvancedSettingsDialog({ catalog, onImportCatalog, onClose }: AdvancedSettingsDialogProps) {
  return (
    <Dialog title="Impostazioni avanzate" narrow onClose={onClose}>
      <section className={styles.section}>
        <h3 className={styles.heading}>
          Gioco dei personaggi <span className={styles.beta}>Beta</span>
        </h3>
        <p className={styles.text}>
          Anime Adventure nasce con i personaggi di Dragon Ball Z: Budokai Tenkaichi 3. Si può già
          caricare la lista dei personaggi di un altro gioco, ma è una funzione in prova: missioni e
          domande incluse sono fatte per Budokai Tenkaichi 3.
        </p>

        <h4 className={styles.label}>Lista in uso</h4>
        {catalog ? (
          <ul className={styles.figures}>
            {catalogFigures(catalog).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.text}>{NO_CATALOG}</p>
        )}

        <button className={styles.import} onClick={onImportCatalog}>
          Importa lista personaggi
        </button>
        <p className={styles.note}>
          Un file CSV con le colonne di docs/personaggi-bt3.xlsx (da Excel: Salva con nome → CSV
          UTF-8). Vale per le partite nuove: partite e puntate già salvate tengono la loro lista.
        </p>
      </section>

      <div className={styles.buttons}>
        <button onClick={onClose}>Chiudi</button>
      </div>
    </Dialog>
  );
}

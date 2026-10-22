import { useState } from 'react';
import type { CatalogSummary } from '../catalog/importCatalog';
import { ThemeSymbol } from '../theme/ThemeSymbol';
import { useTheme } from '../theme/ThemeProvider';
import { FRAMES, SYMBOLS, themeById } from '../theme/themes';
import { Dialog } from '../ui/Dialog';
import { browserPreferences } from './mapGroups';
import {
  isPhoneVersion,
  PHONE_PREFERENCES,
  readPhonePreference,
  writePhonePreference,
  type PhonePreference,
} from '../phone/phoneMode';
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
 * that are ready but still on trial, marked "Beta" (D-068), and the frame and
 * symbol of the windows (spec 050, 2.6; D-078).
 */
export function AdvancedSettingsDialog({ catalog, onImportCatalog, onClose }: AdvancedSettingsDialogProps) {
  return (
    <Dialog title="Impostazioni avanzate" narrow onClose={onClose}>
      <LookSection />
      <PhoneSection />

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

/**
 * «Versione telefono» (spec 052, 2.1; D-083): automatic, always or never.
 * A new choice reloads the page, which opens as the director or as the phone game.
 */
function PhoneSection() {
  const [preference, setPreference] = useState<PhonePreference>(() => readPhonePreference(browserPreferences()));
  const option = (chosen: boolean) => (chosen ? `${styles.option} ${styles.chosen}` : styles.option);
  const choose = (value: PhonePreference) => {
    if (value === preference) {
      return;
    }
    setPreference(value);
    if (writePhonePreference(browserPreferences(), value)) {
      window.location.reload();
    }
  };
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Versione telefono</h3>
      <p className={styles.text}>
        Su telefono e tablet l'app è un gioco 1 contro 1 sullo stesso telefono, senza regia né stream.
        «Automatica» la sceglie da sola: telefono e tablet senza mouse sì, PC no. Ora è{' '}
        {isPhoneVersion() ? 'la versione telefono' : 'la regia'}.
      </p>
      <div className={styles.options}>
        {PHONE_PREFERENCES.map((entry) => (
          <button
            key={entry.value}
            className={option(preference === entry.value)}
            aria-pressed={preference === entry.value}
            onClick={() => choose(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>La pagina si ricarica: la partita in corso resta salvata.</p>
    </section>
  );
}

/** «Aspetto» (spec 050, 2.6): a frame or a symbol chosen here holds in every theme. */
function LookSection() {
  const { choice, choose } = useTheme();
  const theme = themeById(choice.theme);
  const themeFrame = FRAMES.find((frame) => frame.id === theme.frame);
  const option = (chosen: boolean) => (chosen ? `${styles.option} ${styles.chosen}` : styles.option);
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Aspetto</h3>
      <p className={styles.text}>
        Cornice e simbolo delle finestre. Scelti qui valgono per tutti i temi; «quella del tema» e
        «quello del tema» tornano a seguire ogni tema.
      </p>

      <h4 className={styles.label}>Cornice</h4>
      <div className={styles.options}>
        <button className={option(choice.frame === null)} aria-pressed={choice.frame === null} onClick={() => choose({ frame: null })}>
          Quella del tema ({themeFrame?.letter} · {themeFrame?.name})
        </button>
        {FRAMES.map((frame) => (
          <button
            key={frame.id}
            className={option(choice.frame === frame.id)}
            aria-pressed={choice.frame === frame.id}
            onClick={() => choose({ frame: frame.id })}
          >
            {frame.letter} · {frame.name}
          </button>
        ))}
      </div>

      <h4 className={styles.label}>Simbolo</h4>
      <div className={styles.options}>
        <button
          className={option(choice.symbol === null)}
          aria-pressed={choice.symbol === null}
          onClick={() => choose({ symbol: null })}
        >
          <ThemeSymbol place="swatch" symbol={theme.symbol} />
          Quello del tema
        </button>
        {SYMBOLS.map((symbol) => (
          <button
            key={symbol.id}
            className={option(choice.symbol === symbol.id)}
            aria-pressed={choice.symbol === symbol.id}
            title={symbol.meaning}
            onClick={() => choose({ symbol: symbol.id })}
          >
            <ThemeSymbol place="swatch" symbol={symbol.id} />
            {symbol.name}
          </button>
        ))}
      </div>
    </section>
  );
}

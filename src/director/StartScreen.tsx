import { useRef, useState, type ChangeEvent } from 'react';
import { currentState, type Game } from '../engine';
import type { CatalogSummary } from '../catalog/importCatalog';
import { DragonBall, DragonRadar } from '../theme/DragonBall';
import { START_ART } from '../theme/startArt';
import { ThemeSymbol } from '../theme/ThemeSymbol';
import { ThemesDialog } from '../theme/ThemesDialog';
import { useTheme } from '../theme/ThemeProvider';
import { startBackground } from '../theme/themes';
import { START_PAGE_BACKGROUND } from '../ui/layoutImages';
import { AdvancedSettingsDialog } from './AdvancedSettingsDialog';
import { startMenu, type StartMenuId } from './startMenu';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  saved: Game | null;
  /** Summary of the imported character list, or null when none was imported. */
  catalog: CatalogSummary | null;
  onResume(): void;
  onNewGame(): void;
  onLoadFile(file: File): void;
  onImportCatalog(file: File): void;
  onOpenMaps(): void;
  onOpenEpisodes(): void;
  /** The phone version (spec 052, 2.2): no «Regia» under the title, no file loading. */
  phone?: boolean;
}

/** First screen of the director window (spec 003, 2.1; spec 024; spec 042; spec 050). */
export function StartScreen(props: StartScreenProps) {
  const { saved, catalog } = props;
  const savedState = saved ? currentState(saved) : null;
  const gameFile = useRef<HTMLInputElement>(null);
  const catalogFile = useRef<HTMLInputElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const { choice } = useTheme();
  const background = startBackground(START_PAGE_BACKGROUND, choice.theme);

  // The file buttons are real buttons, so they look and behave like the
  // others (Tab, hint); they open the hidden file pickers below. The one of
  // the character list is in the advanced settings (spec 042).
  const actions: Record<StartMenuId, () => void> = {
    resume: props.onResume,
    newGame: props.onNewGame,
    episodes: props.onOpenEpisodes,
    maps: props.onOpenMaps,
    loadFile: () => gameFile.current?.click(),
    themes: () => setThemesOpen(true),
  };

  return (
    <div className={styles.page}>
      {background.kind === 'channel' ? (
        <div
          className={styles.backdrop}
          style={{ backgroundImage: `url("${background.url}")` }}
          aria-hidden="true"
        />
      ) : (
        <div
          className={`${styles.art} ${styles[background.art]}`}
          style={{ backgroundImage: `url("${START_ART[background.art]}")` }}
          aria-hidden="true"
        />
      )}

      <div className={styles.column}>
        <header className={styles.header}>
          <ThemeSymbol place="head" />
          <h1 className={styles.title}>Anime Adventure</h1>
          {!props.phone && <p className={styles.subtitle}>Regia</p>}
        </header>

        <nav className={styles.menu} aria-label="Menu iniziale">
          {startMenu(savedState !== null, props.phone).map((item) => (
            <div
              key={item.id}
              className={item.stars === null ? `${styles.item} ${styles.resume}` : styles.item}
            >
              <button
                className={item.primary ? `${styles.button} ${styles.primary}` : styles.button}
                aria-describedby={`start-hint-${item.id}`}
                onClick={actions[item.id]}
              >
                {item.stars === null ? (
                  <DragonRadar className={styles.icon} blipClassName={styles.blip} />
                ) : (
                  <DragonBall stars={item.stars} className={styles.icon} />
                )}
                {item.label}
                {item.id === 'resume' && savedState && (
                  <small>
                    {savedState.players.p1.name} contro {savedState.players.p2.name} · turno{' '}
                    {savedState.turn}
                  </small>
                )}
              </button>
              <span id={`start-hint-${item.id}`} role="tooltip" className={styles.hint}>
                {item.hint}
              </span>
            </div>
          ))}
        </nav>

        <button className={styles.advanced} onClick={() => setAdvancedOpen(true)}>
          <span aria-hidden="true">⚙</span> Impostazioni avanzate
        </button>
      </div>

      {advancedOpen && (
        <AdvancedSettingsDialog
          catalog={catalog}
          onImportCatalog={() => catalogFile.current?.click()}
          onClose={() => setAdvancedOpen(false)}
        />
      )}

      {themesOpen && <ThemesDialog onClose={() => setThemesOpen(false)} />}

      <input
        ref={gameFile}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={withFile(props.onLoadFile)}
      />
      <input
        ref={catalogFile}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={withFile(props.onImportCatalog)}
      />
    </div>
  );
}

/** Hands the chosen file over, and clears the picker so the same file can be chosen again. */
function withFile(onFile: (file: File) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onFile(file);
    }
  };
}

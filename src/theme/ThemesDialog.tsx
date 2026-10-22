import { Dialog } from '../ui/Dialog';
import { Frame, FrameTitle } from './Frame';
import { useTheme } from './ThemeProvider';
import { THEMES } from './themes';
import styles from './ThemesDialog.module.css';

/**
 * «Temi» (spec 050, 2.5): the five themes as cards, each in its colours, with
 * its frame and symbol (or the ones chosen in the advanced settings). A click
 * applies the theme at once, to the director and the stream.
 */
export function ThemesDialog({ onClose }: { onClose(): void }) {
  const { choice, choose } = useTheme();
  return (
    <Dialog title="Temi" onClose={onClose}>
      <p className={styles.note}>
        Un clic su un tema lo applica subito, anche allo stream. Cornice e simbolo si cambiano da
        «Impostazioni avanzate».
      </p>
      <div className={styles.cards}>
        {THEMES.map((theme) => {
          const current = theme.id === choice.theme;
          return (
            <div
              key={theme.id}
              className={current ? `${styles.card} ${styles.current}` : styles.card}
              data-theme={theme.id}
              onClick={() => choose({ theme: theme.id })}
            >
              <Frame
                frame={choice.frame ?? theme.frame}
                symbol={choice.symbol ?? theme.symbol}
                contentClassName={styles.preview}
              >
                <FrameTitle className={styles.name}>
                  {theme.number} · {theme.name}
                </FrameTitle>
                <p className={styles.description}>{theme.description}</p>
                <div className={styles.swatches} aria-hidden="true">
                  <i style={{ background: 'var(--bg)' }} />
                  <i style={{ background: 'var(--panel)' }} />
                  <i style={{ background: 'var(--accent)' }} />
                  <i style={{ background: 'var(--accent-2)' }} />
                  <i style={{ background: 'var(--frame-mid)' }} />
                </div>
                <button
                  className={current ? styles.inUse : styles.choose}
                  aria-pressed={current}
                  onClick={(event) => {
                    event.stopPropagation();
                    choose({ theme: theme.id });
                  }}
                >
                  {current ? 'In uso' : 'Usa questo tema'}
                </button>
              </Frame>
            </div>
          );
        })}
      </div>
      <div className={styles.buttons}>
        <button onClick={onClose}>Chiudi</button>
      </div>
    </Dialog>
  );
}

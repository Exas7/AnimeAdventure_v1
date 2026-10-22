import { Dialog } from '../ui/Dialog';
import { Frame, FrameTitle } from './Frame';
import { ThemeSymbol } from './ThemeSymbol';
import { useTheme } from './ThemeProvider';
import { FRAMES, SYMBOLS, THEMES, themeById } from './themes';
import styles from './ThemesDialog.module.css';

/**
 * «Temi» (spec 050, 2.5): the five themes as cards, each in its colours, with
 * its frame and symbol (or the ones chosen below). A click applies the theme
 * at once, to the director and the stream. Under the cards, the frame and the
 * symbol (spec 060, 2.1; D-089).
 */
export function ThemesDialog({ onClose }: { onClose(): void }) {
  const { choice, choose } = useTheme();
  return (
    <Dialog title="Temi" onClose={onClose}>
      <p className={styles.note}>
        Un clic su un tema lo applica subito, anche allo stream. Sotto i temi si cambiano cornice e
        simbolo delle finestre.
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
      <FrameAndSymbol />
    </Dialog>
  );
}

/** «Cornice e simbolo» (spec 050, 2.6; spec 060, 2.1): a frame or a symbol chosen here holds in every theme. */
function FrameAndSymbol() {
  const { choice, choose } = useTheme();
  const theme = themeById(choice.theme);
  const themeFrame = FRAMES.find((frame) => frame.id === theme.frame);
  const option = (chosen: boolean) => (chosen ? `${styles.option} ${styles.chosen}` : styles.option);
  return (
    <section className={styles.look}>
      <h3 className={styles.heading}>Cornice e simbolo</h3>
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

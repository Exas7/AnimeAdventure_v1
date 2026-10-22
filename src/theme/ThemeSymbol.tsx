import { useId } from 'react';
import { glyphLayout, KANJI, type KanjiSymbol } from './glyphs';
import { useTheme } from './ThemeProvider';
import { SYMBOLS, type SymbolId } from './themes';
import styles from './ThemeSymbol.module.css';

/** Where the symbol sits (spec 050, 2.3): above the start page title, on a window's chest or back, or as the medal of frame B. */
export type SymbolPlace = 'head' | 'chest' | 'back' | 'medal' | 'swatch';

interface ThemeSymbolProps {
  place: SymbolPlace;
  /** Another symbol than the one in use: the previews of «Temi» and «Aspetto». */
  symbol?: SymbolId;
  className?: string;
}

/** The symbol of the gi: white disc, black ring, the kanji or the drawing in black. */
export function ThemeSymbol({ place, symbol, className }: ThemeSymbolProps) {
  const theme = useTheme();
  const id = symbol ?? theme.symbol;
  return (
    <span
      className={[styles.badge, styles[place], className].filter(Boolean).join(' ')}
      title={place === 'swatch' ? SYMBOLS.find((entry) => entry.id === id)?.meaning : undefined}
      aria-hidden={place === 'swatch' ? undefined : true}
    >
      <SymbolDrawing id={id} />
    </span>
  );
}

function SymbolDrawing({ id }: { id: SymbolId }) {
  if (id === 'kaio') {
    return <KingKaiEmblem />;
  }
  if (id === 'whis') {
    return <WhisSignature />;
  }
  return <Kanji id={id} />;
}

function Kanji({ id }: { id: KanjiSymbol }) {
  const { char, ink } = KANJI[id];
  const { x, y, fontSize } = glyphLayout(ink);
  return (
    <svg className={styles.drawing} viewBox="0 0 100 100">
      <text x={x} y={y} fontSize={fontSize} fill="currentColor" style={{ fontFamily: 'var(--font-kanji)' }}>
        {char}
      </text>
    </svg>
  );
}

/**
 * King Kai's emblem (界王 drawn as stripes), traced from the anime: a black
 * disc with white bars. Coordinates are the reference picture's pixels; the
 * left half is drawn and mirrored.
 */
function KingKaiEmblem() {
  // React's ids hold characters that url(#…) does not take: letters and digits only.
  const id = `kaio${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [top, all, cut, half] = ['top', 'all', 'cut', 'half'].map((part) => `${id}${part}`);
  return (
    <svg className={styles.drawing} viewBox="37.5 67.5 186.8 186.8">
      <defs>
        <clipPath id={top}>
          <circle cx="130.9" cy="160.9" r="73" />
        </clipPath>
        <clipPath id={all}>
          <circle cx="130.9" cy="160.9" r="82.9" />
        </clipPath>
        <mask id={cut} maskUnits="userSpaceOnUse" x="37.5" y="67.5" width="186.8" height="186.8">
          <rect x="37.5" y="67.5" width="186.8" height="186.8" fill="#fff" />
          <g id={half} fill="#000">
            <g clipPath={`url(#${top})`}>
              <rect x="0" y="88.5" width="123" height="9.3" />
              <rect x="0" y="112.8" width="123" height="9.4" />
            </g>
            <g clipPath={`url(#${all})`}>
              <path d="M0 135.8H83V137.5C82 141 72 144.8 62 144.8H0Z" />
              <path d="M130.9 135.8H106.5C104.5 143 99 148.5 91 153.5V169.8H130.9Z" />
              <rect x="0" y="158.5" width="75.5" height="11.3" />
              <rect x="0" y="185.5" width="123" height="12.5" />
              <path d="M0 213.8H123V228.6L93 219.5L80.5 245H0Z" />
            </g>
          </g>
          <use href={`#${half}`} transform="translate(261.8 0) scale(-1 1)" />
        </mask>
      </defs>
      <circle cx="130.9" cy="160.9" r="89" fill="currentColor" mask={`url(#${cut})`} />
    </svg>
  );
}

/** Whis's signature, traced from the anime: a wide open arc, a small circle and the line that joins it. */
function WhisSignature() {
  return (
    <svg className={styles.drawing} viewBox="0 0 100 100">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25.7 80.1A31.7 31.7 0 1 1 78.9 54.1" />
        <circle cx="56.6" cy="60.2" r="15.8" />
        <path d="M72 16.6L60.2 41.6Q57.8 43 53.9 44.6" />
      </g>
    </svg>
  );
}

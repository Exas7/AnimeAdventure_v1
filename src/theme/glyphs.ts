/**
 * Where the ink of a character lies around its starting point, at 100 px:
 * what Chrome reports as actualBoundingBox (left grows leftwards, so it is
 * negative when the ink starts to the right of the starting point).
 */
export interface Ink {
  left: number;
  right: number;
  ascent: number;
  descent: number;
}

export type KanjiSymbol = 'kame' | 'go' | 'ryu' | 'kami';

/** The four kanji, measured once on src/fonts/PottaOne-kanji.woff2 (spec 050, D-079). */
export const KANJI: Record<KanjiSymbol, { char: string; ink: Ink }> = {
  kame: { char: '亀', ink: { left: -3, right: 98, ascent: 86, descent: 8 } },
  go: { char: '悟', ink: { left: -2, right: 97, ascent: 84, descent: 8 } },
  ryu: { char: '龍', ink: { left: -4, right: 97, ascent: 85, descent: 9 } },
  kami: { char: '神', ink: { left: -3, right: 94, ascent: 85, descent: 8 } },
};

/**
 * Starting point and size of a character in a 100 x 100 drawing, so that its
 * ink (not the font's box around it) is centred, its longer side `size` long.
 */
export function glyphLayout(ink: Ink, size = 64): { x: number; y: number; fontSize: number } {
  const width = ink.left + ink.right;
  const height = ink.ascent + ink.descent;
  const scale = size / Math.max(width, height);
  return {
    x: 50 - ((ink.right - ink.left) / 2) * scale,
    y: 50 + ((ink.ascent - ink.descent) / 2) * scale,
    fontSize: 100 * scale,
  };
}

import { describe, expect, it } from 'vitest';
import { glyphLayout, KANJI } from './glyphs';

describe('kanji centred on their ink (spec 050, 2.3; criterion 9)', () => {
  for (const [id, { char, ink }] of Object.entries(KANJI)) {
    it(`${char} (${id}): the ink box is centred and 64 long on its longer side`, () => {
      const { x, y, fontSize } = glyphLayout(ink);
      const scale = fontSize / 100;
      const left = x - ink.left * scale;
      const right = x + ink.right * scale;
      const top = y - ink.ascent * scale;
      const bottom = y + ink.descent * scale;
      expect((left + right) / 2).toBeCloseTo(50);
      expect((top + bottom) / 2).toBeCloseTo(50);
      expect(Math.max(right - left, bottom - top)).toBeCloseTo(64);
    });
  }

  it('another size keeps the centre', () => {
    const { x, fontSize } = glyphLayout({ left: 0, right: 100, ascent: 50, descent: 0 }, 50);
    expect(fontSize).toBeCloseTo(50);
    expect(x).toBeCloseTo(25);
  });
});

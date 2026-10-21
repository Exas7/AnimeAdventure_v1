import { describe, expect, it } from 'vitest';
import {
  availableKeepers,
  isSpecialKeeper,
  keepersUsedIn,
  looksLikeSpecialKeeper,
  makeSpecialKeeper,
} from './specialKeepers';

const PICTURE = 'data:image/png;base64,AAAA';
const oldVersion = makeSpecialKeeper('k-old', 'Mercante', PICTURE);
const newVersion = makeSpecialKeeper('k-new', 'Mercante', PICTURE);
const other = makeSpecialKeeper('k-other', '  Oste  ', PICTURE);

describe('special shopkeepers (spec 022, D-035)', () => {
  it('are shopkeepers with their own picture; the name is trimmed', () => {
    expect(other).toEqual({ id: 'k-other', name: 'Oste', shopkeeper: true, imageData: PICTURE });
    expect(isSpecialKeeper(other)).toBe(true);
    expect(isSpecialKeeper({ id: 'kami', name: 'Kami', shopkeeper: true })).toBe(false);
  });

  it('only well-formed ones are read back', () => {
    expect(looksLikeSpecialKeeper(other)).toBe(true);
    expect(looksLikeSpecialKeeper({ ...other, name: ' ' })).toBe(false);
    expect(looksLikeSpecialKeeper({ ...other, imageData: 'https://example.com/a.png' })).toBe(false);
    expect(looksLikeSpecialKeeper({ ...other, shopkeeper: undefined })).toBe(false);
    expect(looksLikeSpecialKeeper(null)).toBe(false);
  });

  it('an episode keeps a copy of those that keep one of its shops', () => {
    const content = { sh1: { characterId: 'k-old', forSale: ['goku'] }, c1: { characterId: 'goku' } };
    expect(keepersUsedIn(content, [oldVersion, other])).toEqual([oldVersion]);
  });

  it("an episode's copy of an older version shows apart from the library", () => {
    expect(availableKeepers([newVersion, other], [oldVersion, other])).toEqual({
      library: [newVersion, other],
      onlyInEpisode: [oldVersion],
    });
  });
});

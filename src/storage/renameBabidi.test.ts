import { describe, expect, it } from 'vitest';
import { PRICES_BEFORE_066 } from '../included/fillIncluded';
import { pricesFingerprint } from '../included/fingerprint';
import { includedCatalog } from '../included/includedLists';
import { renameBabidi, renameBabidiText } from './renameBabidi';

describe('the rename Bobbidi → Babidi in what a browser saved (spec 079, criterion 2)', () => {
  it('rewrites names, codes and keys, in texts and in saved games written as text', () => {
    const before = {
      id: 'bobbidi',
      name: 'Bobbidi',
      team: ['hero-1', 'bobbidi'],
      byCharacter: { bobbidi: 3 },
      line: 'Bobbidi mi ha dato ciò che volevo.',
      game: '{"cells":{"c1":{"characterId":"bobbidi"}}}',
    };
    expect(renameBabidi(before)).toEqual({
      id: 'babidi',
      name: 'Babidi',
      team: ['hero-1', 'babidi'],
      byCharacter: { babidi: 3 },
      line: 'Babidi mi ha dato ciò che volevo.',
      game: '{"cells":{"c1":{"characterId":"babidi"}}}',
    });
  });

  it('leaves the pictures, the numbers and the other names as they are', () => {
    const value = { imageData: 'data:image/webp;base64,Qm9iYmlkaQ==', n: 4, flag: true, nothing: null, other: 'Bibidi' };
    expect(renameBabidi(value)).toEqual(value);
  });

  it('does not change the value it is given', () => {
    const before = { id: 'bobbidi' };
    renameBabidi(before);
    expect(before.id).toBe('bobbidi');
    expect(renameBabidiText('bobbidi Bobbidi')).toBe('babidi Babidi');
  });

  it('a list saved with the old code, renamed, is the list the app looks for (spec 079, criterion 5)', () => {
    const prices = { 1000: 1500, 1100: 1700, 1200: 1900, 1400: 2200, 1600: 2500, 1800: 2800, 2200: 3400, 2500: 3800, 2700: 4200, 3200: 5000, 3600: 5500, 3900: 6000 } as Record<number, number>;
    const saved = includedCatalog()
      .filter((character) => !['livio', 'maggi', 'meliador'].includes(character.id))
      .map((character) => ({
        ...character,
        id: character.id === 'babidi' ? 'bobbidi' : character.id,
        name: character.name === 'Babidi' ? 'Bobbidi' : character.name,
        price: character.price === undefined ? undefined : prices[character.price],
      }));
    expect(saved.some((character) => character.id === 'bobbidi')).toBe(true);
    expect(pricesFingerprint(saved)).not.toBe(PRICES_BEFORE_066);
    expect(pricesFingerprint(renameBabidi(saved))).toBe(PRICES_BEFORE_066);
  });
});

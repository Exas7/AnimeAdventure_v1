import { describe, expect, it } from 'vitest';
import { isGuest, oneGuestAtMost } from './guests';

describe('the guests (spec 074, 2.5; D-100)', () => {
  const pool = [{ id: 'bulma' }, { id: 'maggi' }, { id: 'kami' }, { id: 'livio' }, { id: 'meliador' }];

  it('Livio, Maggi and Meliador are the guests', () => {
    expect(['livio', 'maggi', 'meliador'].every(isGuest)).toBe(true);
    expect(isGuest('bulma')).toBe(false);
  });

  it('keeps the first guest of the draw and leaves out the others', () => {
    expect(oneGuestAtMost(pool, false).map((entry) => entry.id)).toEqual(['bulma', 'maggi', 'kami']);
  });

  it('with a guest already on the board, none', () => {
    expect(oneGuestAtMost(pool, true).map((entry) => entry.id)).toEqual(['bulma', 'kami']);
  });
});

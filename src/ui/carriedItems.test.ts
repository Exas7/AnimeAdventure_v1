import { describe, expect, it } from 'vitest';
import { placesIn, visibleItems } from './carriedItems';

describe('items carried on the stream (spec 045, 2.3)', () => {
  it('shows them all when they fit', () => {
    expect(visibleItems(['senzu', 'senzu', 'flying-nimbus'], 3)).toEqual({
      shown: ['senzu', 'senzu', 'flying-nimbus'],
      more: 0,
    });
  });

  it('when they do not fit, the last place says how many more there are', () => {
    expect(visibleItems(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({ shown: ['a', 'b'], more: 3 });
    expect(visibleItems(['a', 'b'], 1)).toEqual({ shown: [], more: 2 });
  });

  it('counts the places of a width, with at least one', () => {
    // Five places of 60 with four gaps of 6 need 324 pixels.
    expect(placesIn(324, 60, 6)).toBe(5);
    expect(placesIn(323, 60, 6)).toBe(4);
    expect(placesIn(10, 60, 6)).toBe(1);
  });
});

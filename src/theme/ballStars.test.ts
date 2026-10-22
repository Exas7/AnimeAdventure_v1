import { describe, expect, it } from 'vitest';
import { starPath, starRadius, starSpots } from './ballStars';

describe('the dragon balls (spec 050, criterion 4)', () => {
  for (const stars of [1, 2, 3, 4, 5, 6, 7]) {
    it(`${stars} ${stars === 1 ? 'star' : 'stars'}: as many as its number, all inside the ball, none overlapping`, () => {
      const spots = starSpots(stars);
      expect(spots).toHaveLength(stars);
      const radius = starRadius(stars);
      for (const [x, y] of spots) {
        // The orange of the ball has radius 44 around (50, 50).
        expect(Math.hypot(x - 50, y - 50) + radius).toBeLessThan(44);
      }
      for (const [i, a] of spots.entries()) {
        for (const b of spots.slice(i + 1)) {
          expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(radius * 1.4);
        }
      }
    });
  }

  it('a star is a closed path of ten corners', () => {
    const path = starPath([50, 50], 10);
    expect(path.startsWith('M50.00 40.00')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path.split('L')).toHaveLength(10);
  });
});

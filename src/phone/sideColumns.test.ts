import { describe, expect, it } from 'vitest';
import { PANEL_MIN_WIDTH, sideColumns } from './sideColumns';

describe('the side columns on a big screen (spec 085)', () => {
  it('a phone keeps the columns it has', () => {
    expect(sideColumns({ width: 932, height: 430 }, 1.4)).toBeNull();
  });

  it('a PC screen: the columns fill what the map leaves, and grow in proportion', () => {
    const box = { width: 1920, height: 1080 };
    const columns = sideColumns(box, 1.4);
    expect(columns).not.toBeNull();
    const { zoom, width } = columns ?? { zoom: 0, width: 0 };
    expect(zoom).toBeGreaterThan(1.5);
    // Map + two columns + the edges of the grid fill the width.
    const mapWidth = (1080 - 16) * 1.4 + 8;
    expect(mapWidth + 2 * zoom * width + 16).toBeCloseTo(1920, 0);
    expect(width).toBeGreaterThanOrEqual(PANEL_MIN_WIDTH);
  });

  it('no room at the sides (a very wide map): the phone columns stay', () => {
    expect(sideColumns({ width: 1920, height: 1080 }, 2.2)).toBeNull();
  });

  it('a low screen limits the zoom by its height', () => {
    const columns = sideColumns({ width: 2400, height: 700 }, 1.2);
    expect(columns?.zoom).toBeLessThanOrEqual(700 / 560);
  });
});

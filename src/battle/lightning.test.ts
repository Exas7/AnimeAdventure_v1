import { describe, expect, it } from 'vitest';
import { BOLT_BOX, lightningBolt } from './lightning';

const points = (line: string) => line.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]);

describe('the electric bolts of the strongest waves (spec 062, 2.2)', () => {
  it('a jagged line from edge to edge of its box, with one or two branches', () => {
    const bolt = lightningBolt(7);
    const main = points(bolt.main);
    expect(main).toHaveLength(17);
    expect(main[0]?.[0]).toBe(0);
    expect(main.at(-1)?.[0]).toBe(BOLT_BOX.width);
    const ys = main.map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(3);
    expect(bolt.branches.length).toBeGreaterThanOrEqual(1);
    expect(bolt.branches.length).toBeLessThanOrEqual(2);
  });

  it('stays inside its box', () => {
    for (let seed = 0; seed < 50; seed++) {
      const bolt = lightningBolt(seed);
      for (const [x, y] of [bolt.main, ...bolt.branches].flatMap(points)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(BOLT_BOX.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(BOLT_BOX.height);
      }
    }
  });

  it('the same seed draws the same bolt, another seed another one', () => {
    expect(lightningBolt(3)).toEqual(lightningBolt(3));
    expect(lightningBolt(3).main).not.toBe(lightningBolt(4).main);
  });
});

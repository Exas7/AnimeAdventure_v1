// The electric bolts around the waves of the strongest (spec 062, 2.2):
// jagged lines with a few branches, each one different, drawn in a box
// 100 wide and 40 high, from the left edge to the right edge.

export const BOLT_BOX = { width: 100, height: 40 } as const;

/** A bolt: the main line and its branches, as SVG polyline points ("x,y x,y …"). */
export interface Bolt {
  main: string;
  branches: string[];
}

/** A small repeatable random sequence (mulberry32): the same seed draws the same bolt. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = [number, number];

/** Splits a line again and again, moving each middle point up or down: the jagged look. */
function jagged(from: Point, to: Point, depth: number, spread: number, random: () => number): Point[] {
  let points: Point[] = [from, to];
  let reach = spread;
  for (let level = 0; level < depth; level++) {
    const next: Point[] = [];
    for (let index = 0; index < points.length - 1; index++) {
      const [x1, y1] = points[index] as Point;
      const [x2, y2] = points[index + 1] as Point;
      const y = (y1 + y2) / 2 + (random() * 2 - 1) * reach;
      next.push([x1, y1], [(x1 + x2) / 2, Math.min(BOLT_BOX.height - 1, Math.max(1, y))]);
    }
    next.push(points[points.length - 1] as Point);
    points = next;
    reach /= 1.8;
  }
  return points;
}

const asPoints = (points: Point[]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** A bolt across the box, with one or two branches leaving it at a slant. */
export function lightningBolt(seed: number): Bolt {
  const random = seededRandom(seed);
  const middle = BOLT_BOX.height / 2;
  const main = jagged([0, middle + (random() - 0.5) * 8], [BOLT_BOX.width, middle + (random() - 0.5) * 8], 4, 13, random);
  const branches: string[] = [];
  const count = 1 + Math.floor(random() * 2);
  for (let branch = 0; branch < count; branch++) {
    const start = main[4 + Math.floor(random() * (main.length - 8))] as Point;
    const up = random() < 0.5 ? -1 : 1;
    const end: Point = [
      Math.min(BOLT_BOX.width, start[0] + 18 + random() * 20),
      Math.min(BOLT_BOX.height - 1, Math.max(1, start[1] + up * (8 + random() * 10))),
    ];
    branches.push(asPoints(jagged(start, end, 2, 5, random)));
  }
  return { main: asPoints(main), branches };
}

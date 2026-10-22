/** A point in the 100 x 100 drawing of a dragon ball. */
export type Point = readonly [number, number];

const CENTRE: Point = [50, 54];

function ring(radius: number, count: number): Point[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = -Math.PI / 2 + (k * 2 * Math.PI) / count;
    return [CENTRE[0] + radius * Math.cos(angle), CENTRE[1] + radius * Math.sin(angle)] as const;
  });
}

/** Where the red stars go on a ball with this many, as on the reference (spec 050, 2.4). */
export function starSpots(stars: number): Point[] {
  switch (stars) {
    case 1:
      return [CENTRE];
    case 2:
      return [[41, 44], [59, 63]];
    case 3:
      return [[50, 39], [38, 62], [62, 62]];
    case 4:
      return [[50, 35], [35, 52], [65, 52], [50, 69]];
    case 5:
      return ring(15, 5);
    case 6:
      return [...ring(17, 5), CENTRE];
    case 7:
      return [...ring(19, 6), CENTRE];
    default:
      return [];
  }
}

/** Bigger stars when there are few of them. */
export function starRadius(stars: number): number {
  return stars <= 2 ? 10.5 : stars <= 4 ? 9 : 7.4;
}

/** A five-pointed star centred on (x, y), pointing up, as an SVG path. */
export function starPath([x, y]: Point, radius: number): string {
  const inner = radius * 0.45;
  const corners = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : inner;
    return `${(x + r * Math.cos(angle)).toFixed(2)} ${(y + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${corners.join('L')}Z`;
}

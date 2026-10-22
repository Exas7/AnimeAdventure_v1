import type { GameMap, Point } from '../engine';
import { boardSize, type BoardSize } from '../ui/boardModel';

/** The visible part of the map, in board units (SVG viewBox). */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ZOOM_STEP = 0.85;

/** The whole map ("Adatta"). */
export function fullView(map: GameMap): ViewBox {
  const size = boardSize(map);
  return { x: 0, y: 0, w: size.width, h: size.height };
}

/**
 * One step of zoom around `anchor` (board units), which stays under the
 * mouse. The view stays between 1/20 and 3 times the board width.
 */
export function zoomAt(view: ViewBox, anchor: Point, zoomIn: boolean, size: BoardSize): ViewBox {
  const factor = zoomIn ? ZOOM_STEP : 1 / ZOOM_STEP;
  const w = Math.min(size.width * 3, Math.max(size.width / 20, view.w * factor));
  const ratio = w / view.w;
  return {
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
    w,
    h: view.h * ratio,
  };
}

/** Moves the view by a mouse drag of (dx, dy) screen pixels on an area `screenWidth` wide. */
export function panBy(view: ViewBox, dx: number, dy: number, screenWidth: number): ViewBox {
  const scale = view.w / (screenWidth || 1);
  return { ...view, x: view.x - dx * scale, y: view.y - dy * scale };
}

/**
 * Two fingers on the map (spec 054, 2.1): the view after the fingers moved
 * from `before` to `after`, both in board units of the current view. The
 * spread zooms, within the limits of `zoomAt`; the point between the
 * fingers stays under them, so moving both fingers moves the view.
 */
export function pinchView(
  view: ViewBox,
  before: readonly [Point, Point],
  after: readonly [Point, Point],
  size: BoardSize,
): ViewBox {
  const spread = (points: readonly [Point, Point]) =>
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const middle = (points: readonly [Point, Point]) => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });
  const wanted = spread(after) > 0 ? view.w * (spread(before) / spread(after)) : view.w;
  const w = Math.min(size.width * 3, Math.max(size.width / 20, wanted));
  const ratio = w / view.w;
  const from = middle(before);
  const to = middle(after);
  return {
    x: from.x - ratio * (to.x - view.x),
    y: from.y - ratio * (to.y - view.y),
    w,
    h: view.h * ratio,
  };
}

/** «+» and «−» (spec 054, 2.2): one step of zoom around the middle of the view. */
export function zoomCentered(view: ViewBox, zoomIn: boolean, size: BoardSize): ViewBox {
  return zoomAt(view, { x: view.x + view.w / 2, y: view.y + view.h / 2 }, zoomIn, size);
}

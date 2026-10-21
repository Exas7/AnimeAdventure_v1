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

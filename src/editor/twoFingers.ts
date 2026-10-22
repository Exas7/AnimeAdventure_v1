import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../engine';
import type { BoardSize } from '../ui/boardModel';
import { pinchView, type ViewBox } from './viewBox';

export interface TwoFingers {
  /** True when the event belongs to the gesture: the drawing area then does nothing else with it. */
  down(event: ReactPointerEvent): boolean;
  move(event: ReactPointerEvent): boolean;
  up(event: ReactPointerEvent): boolean;
}

/**
 * Two fingers on a drawing area (spec 054, 2.1): spreading them zooms,
 * moving them moves the view. When the second finger lands, `onStart`
 * cancels what the first one was doing. Mouse and pen are left alone.
 */
export function useTwoFingers(
  /** A screen point in board units, with the view as it is drawn now. */
  boardPoint: (clientX: number, clientY: number) => Point,
  view: ViewBox,
  size: BoardSize,
  onViewChange: (view: ViewBox) => void,
  onStart: () => void,
): TwoFingers {
  const fingers = useRef(new Map<number, Point>());
  const active = useRef(false);
  const pair = (): [Point, Point] | null => {
    const points = [...fingers.current.values()];
    return points.length === 2 ? [points[0] as Point, points[1] as Point] : null;
  };
  const inBoard = ([a, b]: [Point, Point]): [Point, Point] => [boardPoint(a.x, a.y), boardPoint(b.x, b.y)];

  return {
    down(event) {
      if (event.pointerType !== 'touch') {
        return false;
      }
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.current.size === 2 && !active.current) {
        active.current = true;
        onStart();
      }
      return active.current;
    },
    move(event) {
      if (!active.current || !fingers.current.has(event.pointerId)) {
        return active.current;
      }
      const before = pair();
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = pair();
      if (before && after) {
        onViewChange(pinchView(view, inBoard(before), inBoard(after), size));
      }
      return true;
    },
    up(event) {
      fingers.current.delete(event.pointerId);
      if (!active.current) {
        return false;
      }
      // The gesture lasts until every finger is lifted: one left behind does nothing.
      if (fingers.current.size === 0) {
        active.current = false;
      }
      return true;
    },
  };
}

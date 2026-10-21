import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { CellContent, Character, GameMap, Point } from '../engine';
import { nodesInRect } from '../editor/mapEdit';
import { panBy, zoomAt, type ViewBox } from '../editor/viewBox';
import { BoardLayers } from '../ui/Board';
import { boardSize, contentView } from '../ui/boardModel';
import styles from './PrepCanvas.module.css';

interface PrepCanvasProps {
  map: GameMap;
  catalog: Character[];
  content: Record<string, CellContent>;
  selected: string[];
  view: ViewBox;
  /** Barra spaziatrice premuta: trascinare sposta la vista. */
  panning: boolean;
  onViewChange(view: ViewBox): void;
  onSelect(nodeIds: string[]): void;
}

type Drag =
  | { kind: 'pan'; lastClient: Point }
  | { kind: 'rect'; start: Point; additive: boolean };

/**
 * The map of an episode as it will look on the stream, without pawns
 * (spec 007, 2.2). Cells can be selected; the map itself cannot change here.
 */
export function PrepCanvas(props: PrepCanvasProps) {
  const { map, catalog, content, selected, view, panning } = props;
  const size = boardSize(map);
  const board = useMemo(() => contentView(map, catalog, content), [map, catalog, content]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [rect, setRectState] = useState<{ a: Point; b: Point } | null>(null);
  const rectRef = useRef<{ a: Point; b: Point } | null>(null);
  const setRect = (value: { a: Point; b: Point } | null) => {
    rectRef.current = value;
    setRectState(value);
  };

  /** Mouse position relative to the background (0 to 1), like map coordinates. */
  const eventPoint = (clientX: number, clientY: number): Point => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x / size.width, y: point.y / size.height };
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === 1 || panning) {
      drag.current = { kind: 'pan', lastClient: { x: event.clientX, y: event.clientY } };
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const nodeId =
      (event.target as Element).closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    if (nodeId) {
      props.onSelect(
        event.shiftKey
          ? selected.includes(nodeId)
            ? selected.filter((id) => id !== nodeId)
            : [...selected, nodeId]
          : [nodeId],
      );
      return;
    }
    const point = eventPoint(event.clientX, event.clientY);
    drag.current = { kind: 'rect', start: point, additive: event.shiftKey };
    setRect({ a: point, b: point });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (current?.kind === 'pan') {
      props.onViewChange(
        panBy(
          view,
          event.clientX - current.lastClient.x,
          event.clientY - current.lastClient.y,
          svgRef.current?.clientWidth ?? 0,
        ),
      );
      current.lastClient = { x: event.clientX, y: event.clientY };
    } else if (current?.kind === 'rect') {
      setRect({ a: current.start, b: eventPoint(event.clientX, event.clientY) });
    }
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind !== 'rect') {
      return;
    }
    const area = rectRef.current;
    if (area) {
      const inside = nodesInRect(map, area.a, area.b);
      props.onSelect(current.additive ? [...new Set([...selected, ...inside])] : inside);
    }
    setRect(null);
  };

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const point = eventPoint(event.clientX, event.clientY);
    const anchor = { x: point.x * size.width, y: point.y * size.height };
    props.onViewChange(zoomAt(view, anchor, event.deltaY < 0, size));
  };

  const unit = view.w / size.width; // keeps the selection rings the same size on screen

  return (
    <svg
      ref={svgRef}
      className={`${styles.canvas} ${panning ? styles.panning : ''}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <BoardLayers view={board} />

      <g className={styles.selection}>
        {board.nodes
          .filter((node) => selected.includes(node.id))
          .map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={Math.max(node.radius, 12) + 6 * unit}
              style={{ strokeWidth: 4 * unit }}
            />
          ))}
      </g>

      {rect && (
        <rect
          className={styles.selectionRect}
          x={Math.min(rect.a.x, rect.b.x) * size.width}
          y={Math.min(rect.a.y, rect.b.y) * size.height}
          width={Math.abs(rect.a.x - rect.b.x) * size.width}
          height={Math.abs(rect.a.y - rect.b.y) * size.height}
        />
      )}
    </svg>
  );
}

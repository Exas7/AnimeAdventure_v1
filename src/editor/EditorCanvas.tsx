import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { cellNumber, type GameMap, type NodeType, type Point } from '../engine';
import { boardSize, edgePath } from '../ui/boardModel';
import {
  addCurvePoint,
  addNode,
  connect,
  moveCurvePoint,
  moveNodes,
  nodesInRect,
  removeCurvePoint,
  updateEdge,
  type Selection,
} from './mapEdit';
import { panBy, zoomAt, type ViewBox } from './viewBox';
import styles from './EditorCanvas.module.css';

export type Tool = 'select' | 'cell' | 'path';

interface EditorCanvasProps {
  map: GameMap;
  tool: Tool;
  newCellType: NodeType;
  selection: Selection;
  view: ViewBox;
  /** Barra spaziatrice premuta: trascinare sposta la vista. */
  panning: boolean;
  onViewChange(view: ViewBox): void;
  onSelect(selection: Selection): void;
  /** A finished change: it goes into undo history. */
  onCommit(map: GameMap, selection?: Selection): void;
  /**
   * Path whose opening cell is being chosen (D-027): the next click on a
   * cell links it, a click elsewhere gives up.
   */
  pickingFor: string | null;
  onPickingChange(edgeId: string | null): void;
}

type Drag =
  | { kind: 'pan'; lastClient: Point }
  | { kind: 'move'; start: Point; nodeIds: string[]; moved: boolean }
  | { kind: 'rect'; start: Point; additive: boolean }
  | { kind: 'connect'; from: string }
  | { kind: 'curve'; edgeId: string; index: number; base: GameMap };

const RADIUS: Record<NodeType, number> = { empty: 12, special: 18, start: 30, shop: 30, character: 30 };
const TYPE_LABEL: Record<NodeType, string> = {
  empty: '',
  special: '',
  start: 'Partenza',
  shop: 'Negozio',
  character: 'Personaggio',
};

/**
 * Drawing area of the map editor (spec 006). Positions are kept relative to
 * the background (0 to 1); on screen they are scaled to board units.
 */
export function EditorCanvas(props: EditorCanvasProps) {
  const { map, tool, newCellType, selection, view, panning } = props;
  const size = boardSize(map);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  // Kept both as state (to draw) and as refs (to read in the next pointer event).
  const [draft, setDraftState] = useState<GameMap | null>(null);
  const draftRef = useRef<GameMap | null>(null);
  const [rect, setRectState] = useState<{ a: Point; b: Point } | null>(null);
  const rectRef = useRef<{ a: Point; b: Point } | null>(null);
  const [connectLine, setConnectLine] = useState<{ from: Point; to: Point } | null>(null);

  const setDraft = (value: GameMap | null) => {
    draftRef.current = value;
    setDraftState(value);
  };
  const setRect = (value: { a: Point; b: Point } | null) => {
    rectRef.current = value;
    setRectState(value);
  };

  const shown = draft ?? map;
  // Choosing a cell only makes sense while that path alone is selected.
  const pickingEdgeId =
    props.pickingFor !== null &&
    selection.nodes.length === 0 &&
    selection.edges.length === 1 &&
    selection.edges[0] === props.pickingFor
      ? props.pickingFor
      : null;
  const toBoard = (point: Point): Point => ({ x: point.x * size.width, y: point.y * size.height });
  const unit = view.w / size.width; // keeps handles the same size on screen when zooming

  const eventPoint = (clientX: number, clientY: number): Point => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x / size.width, y: point.y / size.height };
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    const point = eventPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.button === 1 || panning) {
      drag.current = { kind: 'pan', lastClient: { x: event.clientX, y: event.clientY } };
      return;
    }
    if (event.button !== 0) {
      return;
    }

    if (pickingEdgeId) {
      const picked = target.closest('[data-node-id]')?.getAttribute('data-node-id');
      if (picked) {
        props.onCommit(updateEdge(map, pickingEdgeId, { unlockNodeId: picked }), {
          nodes: [],
          edges: [pickingEdgeId],
        });
      }
      props.onPickingChange(null);
      return;
    }

    const curveHandle = target.closest('[data-curve-edge]');
    if (curveHandle) {
      const edgeId = curveHandle.getAttribute('data-curve-edge') ?? '';
      const index = Number(curveHandle.getAttribute('data-curve-index'));
      const base =
        curveHandle.getAttribute('data-curve-kind') === 'insert'
          ? addCurvePoint(map, edgeId, index, point)
          : map;
      setDraft(base);
      drag.current = { kind: 'curve', edgeId, index, base };
      return;
    }

    const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    const edgeId = target.closest('[data-edge-id]')?.getAttribute('data-edge-id') ?? null;

    if (tool === 'path') {
      const from = map.nodes.find((node) => node.id === nodeId);
      if (from) {
        drag.current = { kind: 'connect', from: from.id };
        setConnectLine({ from: toBoard(from), to: toBoard(point) });
      }
      return;
    }
    if (tool === 'cell') {
      if (nodeId) {
        props.onSelect({ nodes: [nodeId], edges: [] });
      } else if (!edgeId) {
        const added = addNode(map, point, newCellType);
        props.onCommit(added.map, { nodes: [added.nodeId], edges: [] });
      }
      return;
    }

    // Select tool.
    if (nodeId) {
      if (event.shiftKey) {
        props.onSelect(toggle(selection, 'nodes', nodeId));
        return;
      }
      const nodeIds = selection.nodes.includes(nodeId) ? selection.nodes : [nodeId];
      if (!selection.nodes.includes(nodeId)) {
        props.onSelect({ nodes: nodeIds, edges: [] });
      }
      drag.current = { kind: 'move', start: point, nodeIds, moved: false };
      return;
    }
    if (edgeId) {
      props.onSelect(
        event.shiftKey ? toggle(selection, 'edges', edgeId) : { nodes: [], edges: [edgeId] },
      );
      return;
    }
    drag.current = { kind: 'rect', start: point, additive: event.shiftKey };
    setRect({ a: point, b: point });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) {
      return;
    }
    if (current.kind === 'pan') {
      props.onViewChange(
        panBy(
          view,
          event.clientX - current.lastClient.x,
          event.clientY - current.lastClient.y,
          svgRef.current?.clientWidth ?? 0,
        ),
      );
      current.lastClient = { x: event.clientX, y: event.clientY };
      return;
    }
    const point = eventPoint(event.clientX, event.clientY);
    switch (current.kind) {
      case 'move': {
        const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
        current.moved ||= Math.abs(delta.x) + Math.abs(delta.y) > 0.002;
        if (current.moved) {
          setDraft(moveNodes(map, current.nodeIds, delta));
        }
        break;
      }
      case 'rect':
        setRect({ a: current.start, b: point });
        break;
      case 'connect':
        setConnectLine((line) => (line ? { from: line.from, to: toBoard(point) } : line));
        break;
      case 'curve':
        setDraft(moveCurvePoint(current.base, current.edgeId, current.index, point));
        break;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current) {
      return;
    }
    switch (current.kind) {
      case 'move':
      case 'curve':
        if (draftRef.current && (current.kind === 'curve' || current.moved)) {
          props.onCommit(draftRef.current);
        }
        setDraft(null);
        break;
      case 'rect': {
        const area = rectRef.current;
        if (area) {
          const inside = nodesInRect(map, area.a, area.b);
          props.onSelect(
            current.additive
              ? { nodes: [...new Set([...selection.nodes, ...inside])], edges: selection.edges }
              : { nodes: inside, edges: [] },
          );
        }
        setRect(null);
        break;
      }
      case 'connect': {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const to = element?.closest('[data-node-id]')?.getAttribute('data-node-id');
        const result = to ? connect(map, current.from, to) : null;
        if (result) {
          props.onCommit(result.map, { nodes: [], edges: [result.edgeId] });
        }
        setConnectLine(null);
        break;
      }
      case 'pan':
        break;
    }
  };

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const anchor = toBoard(eventPoint(event.clientX, event.clientY));
    props.onViewChange(zoomAt(view, anchor, event.deltaY < 0, size));
  };

  const nodesById = new Map(shown.nodes.map((node) => [node.id, node]));
  const selectedEdge =
    selection.edges.length === 1 && selection.nodes.length === 0
      ? shown.edges.find((edge) => edge.id === selection.edges[0])
      : undefined;

  return (
    <svg
      ref={svgRef}
      className={[
        styles.canvas,
        styles[tool] ?? '',
        panning ? styles.panning : '',
        pickingEdgeId ? styles.picking : '',
      ].join(' ')}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    >
      {shown.background ? (
        <image
          href={shown.background.image}
          width={size.width}
          height={size.height}
          preserveAspectRatio="none"
        />
      ) : (
        <rect className={styles.background} width={size.width} height={size.height} />
      )}

      {shown.edges.map((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) {
          return null;
        }
        const path = edgePath([toBoard(from), ...edge.curve.map(toBoard), toBoard(to)]);
        const selected = selection.edges.includes(edge.id);
        return (
          <g key={edge.id} data-edge-id={edge.id}>
            <path
              className={[
                styles.edge,
                edge.locked ? styles.locked : '',
                selected ? styles.selected : '',
              ].join(' ')}
              d={path}
            />
            <path className={styles.edgeHit} d={path} style={{ strokeWidth: 26 * unit }} />
          </g>
        );
      })}

      {selectedEdge && (
        <CurveHandles
          points={[
            toBoard(nodesById.get(selectedEdge.from) ?? { x: 0, y: 0 }),
            ...selectedEdge.curve.map(toBoard),
            toBoard(nodesById.get(selectedEdge.to) ?? { x: 0, y: 0 }),
          ]}
          edgeId={selectedEdge.id}
          unit={unit}
          onRemove={(index) => props.onCommit(removeCurvePoint(map, selectedEdge.id, index))}
        />
      )}

      {shown.nodes.map((node) => {
        const center = toBoard(node);
        const selected = selection.nodes.includes(node.id);
        return (
          <g
            key={node.id}
            data-node-id={node.id}
            className={`${styles.node} ${selected ? styles.selected : ''}`}
          >
            {/* The cell that opens the selected path (D-027). */}
            {selectedEdge?.unlockNodeId === node.id && (
              <circle
                className={styles.keyRing}
                cx={center.x}
                cy={center.y}
                r={RADIUS[node.type] + 10}
              />
            )}
            <circle
              className={styles[node.type] ?? ''}
              cx={center.x}
              cy={center.y}
              r={RADIUS[node.type]}
              style={node.type === 'special' && node.color ? { fill: node.color } : undefined}
            />
            {TYPE_LABEL[node.type] && (
              <text className={styles.typeLabel} x={center.x} y={center.y}>
                {TYPE_LABEL[node.type]}
              </text>
            )}
            {/* Character cells have no number around them (spec 013). */}
            {node.type !== 'character' && (
              <text
                className={styles.idLabel}
                x={center.x}
                y={center.y + RADIUS[node.type] + 14}
              >
                {cellNumber(node.id)}
              </text>
            )}
          </g>
        );
      })}

      {rect && (
        <rect
          className={styles.selectionRect}
          x={Math.min(rect.a.x, rect.b.x) * size.width}
          y={Math.min(rect.a.y, rect.b.y) * size.height}
          width={Math.abs(rect.a.x - rect.b.x) * size.width}
          height={Math.abs(rect.a.y - rect.b.y) * size.height}
        />
      )}
      {connectLine && (
        <line
          className={styles.connectLine}
          x1={connectLine.from.x}
          y1={connectLine.from.y}
          x2={connectLine.to.x}
          y2={connectLine.to.y}
        />
      )}
    </svg>
  );
}

interface CurveHandlesProps {
  /** Start cell, curve points, end cell, in board units. */
  points: Point[];
  edgeId: string;
  unit: number;
  onRemove(index: number): void;
}

/** Curve points of the selected path, plus a "+" in the middle of each stretch. */
function CurveHandles({ points, edgeId, unit, onRemove }: CurveHandlesProps) {
  const inner = points.slice(1, -1);
  return (
    <g>
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1] as Point;
        return (
          <g
            key={`insert-${index}`}
            data-curve-edge={edgeId}
            data-curve-index={index}
            data-curve-kind="insert"
            className={styles.insertHandle}
          >
            <circle cx={(point.x + next.x) / 2} cy={(point.y + next.y) / 2} r={10 * unit} />
            <text x={(point.x + next.x) / 2} y={(point.y + next.y) / 2} style={{ fontSize: 16 * unit }}>
              +
            </text>
          </g>
        );
      })}
      {inner.map((point, index) => (
        <circle
          key={`point-${index}`}
          data-curve-edge={edgeId}
          data-curve-index={index}
          data-curve-kind="point"
          className={styles.curvePoint}
          cx={point.x}
          cy={point.y}
          r={9 * unit}
          onDoubleClick={() => onRemove(index)}
        />
      ))}
    </g>
  );
}

function toggle(selection: Selection, key: 'nodes' | 'edges', id: string): Selection {
  const list = selection[key];
  return {
    ...selection,
    [key]: list.includes(id) ? list.filter((other) => other !== id) : [...list, id],
  };
}

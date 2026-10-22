import {
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Character, GameMap, GameState, PlayerId, Point } from '../engine';
import {
  CELL_HIT_RADIUS,
  PAWN_BODY_PATH,
  PAWN_HEAD_RADIUS,
  PAWN_HEAD_Y,
  boardView,
  nodeAtPoint,
  wrapLabel,
  type BoardView,
  type NodeView,
  type PawnView,
} from './boardModel';
import { characterImage } from './characterImages';
import styles from './Board.module.css';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface BoardProps {
  map: GameMap;
  catalog: Character[];
  state: GameState;
  /** Director only: the board is read-only when these are missing (stream). */
  onNodeClick?: (nodeId: string) => void;
  /** Director only, outside edit mode: the preview of a character (spec 020, D-032). */
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeMenu?: (nodeId: string, at: ScreenPoint) => void;
  onEdgeMenu?: (edgeId: string, at: ScreenPoint) => void;
  /** Edit mode only: a left click on a path. */
  onEdgeClick?: (edgeId: string, at: ScreenPoint) => void;
  /** Director only, outside edit mode: a pawn dragged and dropped on a cell (D-026). */
  onPawnDrop?: (player: PlayerId, nodeId: string) => void;
  /** Cells where a travel item can take the pawn (spec 047), on both windows. */
  highlighted?: ReadonlySet<string>;
}

const LINE_HEIGHT = 17;

/** Screen pixels the mouse must travel before a press on a pawn becomes a drag. */
const DRAG_THRESHOLD = 4;

export function Board(props: BoardProps) {
  const { map, catalog, state } = props;
  // D-006: the board shows what the current player can use.
  const view = useMemo(
    () => boardView(map, catalog, state, state.currentPlayer),
    [map, catalog, state],
  );

  return (
    <svg
      className={styles.board}
      viewBox={`0 0 ${view.size.width} ${view.size.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Tabellone"
    >
      <BoardLayers
        view={view}
        onNodeClick={props.onNodeClick}
        onNodeDoubleClick={props.onNodeDoubleClick}
        onNodeMenu={props.onNodeMenu}
        onEdgeMenu={props.onEdgeMenu}
        onEdgeClick={props.onEdgeClick}
        highlighted={props.highlighted}
      />

      <Pawns
        view={view}
        onPawnDrop={props.onPawnDrop}
        onNodeClick={props.onNodeClick}
        onNodeDoubleClick={props.onNodeDoubleClick}
        onNodeMenu={props.onNodeMenu}
      />
    </svg>
  );
}

interface PawnDrag {
  player: PlayerId;
  pointerId: number;
  /** From screen to board units, fixed when the drag starts. */
  toBoard: DOMMatrix;
  startClient: Point;
  /** Feet minus the grabbed point, so the pawn does not jump under the mouse. */
  grab: Point;
  /** Where the feet are now. */
  at: Point;
  moved: boolean;
}

type PawnsProps = Pick<BoardProps, 'onPawnDrop' | 'onNodeClick' | 'onNodeDoubleClick' | 'onNodeMenu'> & {
  view: BoardView;
};

/**
 * The pawns. In the director they can be dragged onto a cell (D-026); a
 * press without dragging counts as a click on the pawn's cell. Only the
 * result of a drop reaches the stream, never the drag itself.
 */
function Pawns({ view, onPawnDrop, onNodeClick, onNodeDoubleClick, onNodeMenu }: PawnsProps) {
  // Kept both as state (to draw) and as a ref (to read in the next pointer event).
  const [drag, setDragState] = useState<PawnDrag | null>(null);
  const dragRef = useRef<PawnDrag | null>(null);
  const setDrag = (value: PawnDrag | null) => {
    dragRef.current = value;
    setDragState(value);
  };
  // The layer holds the mouse during a drag, not the pawn: the dragged pawn
  // is moved on top of the other one, and an element moved in the page
  // loses the mouse.
  const layerRef = useRef<SVGGElement>(null);

  const onPointerDown = (event: ReactPointerEvent<SVGGElement>, pawn: PawnView) => {
    const screen = event.currentTarget.getScreenCTM();
    if (event.button !== 0 || !screen || !layerRef.current) {
      return;
    }
    layerRef.current.setPointerCapture(event.pointerId);
    const toBoard = screen.inverse();
    const grabbed = boardPoint(toBoard, event.clientX, event.clientY);
    setDrag({
      player: pawn.player,
      pointerId: event.pointerId,
      toBoard,
      startClient: { x: event.clientX, y: event.clientY },
      grab: { x: pawn.x - grabbed.x, y: pawn.y - grabbed.y },
      at: { x: pawn.x, y: pawn.y },
      moved: false,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    const travelled = Math.hypot(
      event.clientX - current.startClient.x,
      event.clientY - current.startClient.y,
    );
    const point = boardPoint(current.toBoard, event.clientX, event.clientY);
    setDrag({
      ...current,
      moved: current.moved || travelled > DRAG_THRESHOLD,
      at: { x: point.x + current.grab.x, y: point.y + current.grab.y },
    });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGGElement>) => {
    const current = dragRef.current;
    const pawn = view.pawns.find((candidate) => candidate.player === current?.player);
    if (!current || current.pointerId !== event.pointerId || !pawn) {
      return;
    }
    setDrag(null);
    if (!current.moved) {
      // A press without dragging: like a click on the pawn's cell.
      onNodeClick?.(pawn.nodeId);
      return;
    }
    const target = nodeAtPoint(view.nodes, current.at);
    if (target && target !== pawn.nodeId) {
      onPawnDrop?.(pawn.player, target);
    }
  };

  const dragged = drag?.moved ? view.pawns.find((pawn) => pawn.player === drag.player) : undefined;
  const targetId = drag && dragged ? nodeAtPoint(view.nodes, drag.at) : null;
  const target =
    targetId !== dragged?.nodeId ? view.nodes.find((node) => node.id === targetId) : undefined;
  // The dragged pawn is drawn last, above the other one.
  const pawns = [...view.pawns].sort(
    (a, b) => Number(a === dragged) - Number(b === dragged),
  );

  return (
    <g
      ref={layerRef}
      onPointerMove={onPawnDrop && onPointerMove}
      onPointerUp={onPawnDrop && onPointerUp}
      onPointerCancel={onPawnDrop && (() => setDrag(null))}
      onLostPointerCapture={onPawnDrop && (() => setDrag(null))}
    >
      {target && (
        <circle
          className={styles.dropTarget}
          cx={target.x}
          cy={target.y}
          r={Math.max(target.radius, CELL_HIT_RADIUS) + 6}
        />
      )}
      {pawns.map((pawn) => {
        const at = pawn === dragged && drag ? drag.at : pawn;
        return (
          <g
            key={pawn.player}
            className={[
              styles.pawn,
              pawn.player === 'p1' ? styles.pawnP1 : styles.pawnP2,
              pawn.isCurrent ? styles.pawnCurrent : '',
              onPawnDrop ? styles.pawnDraggable : '',
              pawn === dragged ? styles.pawnDragging : '',
            ].join(' ')}
            transform={`translate(${at.x} ${at.y})`}
            onPointerDown={onPawnDrop && ((event) => onPointerDown(event, pawn))}
            onDoubleClick={onNodeDoubleClick && (() => onNodeDoubleClick(pawn.nodeId))}
            onContextMenu={onPawnDrop && onNodeMenu && menuHandler(onNodeMenu, pawn.nodeId)}
          >
            <path d={PAWN_BODY_PATH} />
            <circle cy={-PAWN_HEAD_Y} r={PAWN_HEAD_RADIUS} />
            <text className={styles.pawnLabel} y={-PAWN_HEAD_Y}>
              {pawn.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function boardPoint(toBoard: DOMMatrix, clientX: number, clientY: number): Point {
  const point = new DOMPoint(clientX, clientY).matrixTransform(toBoard);
  return { x: point.x, y: point.y };
}

type BoardLayersProps = Pick<
  BoardProps,
  'onNodeClick' | 'onNodeDoubleClick' | 'onNodeMenu' | 'onEdgeMenu' | 'onEdgeClick' | 'highlighted'
> & {
  view: BoardView;
};

/** Background, paths and cells: the board without pawns, also used to prepare episodes (spec 007). */
export function BoardLayers(props: BoardLayersProps) {
  const { view, onNodeClick, onNodeDoubleClick, onNodeMenu, onEdgeMenu, onEdgeClick, highlighted } = props;
  // Clip paths need ids unique in the page: two boards may be open at once.
  const clipPrefix = `clip${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <>
      {view.background ? (
        <image
          href={view.background}
          width={view.size.width}
          height={view.size.height}
          preserveAspectRatio="none"
        />
      ) : (
        <rect
          className={styles.background}
          width={view.size.width}
          height={view.size.height}
          rx={24}
        />
      )}

      <g>
        {view.edges.map((edge) => (
          <g key={edge.id}>
            <path className={edge.closed ? styles.edgeClosed : styles.edge} d={edge.path} />
            {(onEdgeMenu || onEdgeClick) && (
              <path
                className={styles.edgeHit}
                data-edge-id={edge.id}
                d={edge.path}
                onContextMenu={onEdgeMenu && menuHandler(onEdgeMenu, edge.id)}
                onClick={
                  onEdgeClick &&
                  ((event) => onEdgeClick(edge.id, { x: event.clientX, y: event.clientY }))
                }
              >
                {edge.lockNote && <title>{edge.lockNote}</title>}
              </path>
            )}
          </g>
        ))}
      </g>

      <g>
        {view.nodes.map((node) => (
          <Cell
            key={node.id}
            node={node}
            clipId={`${clipPrefix}-${node.id}`}
            highlighted={highlighted?.has(node.id) ?? false}
            onClick={onNodeClick && (() => onNodeClick(node.id))}
            onDoubleClick={onNodeDoubleClick && (() => onNodeDoubleClick(node.id))}
            onContextMenu={onNodeMenu && menuHandler(onNodeMenu, node.id)}
          />
        ))}
      </g>
    </>
  );
}

interface CellProps {
  node: NodeView;
  clipId: string;
  highlighted: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}

function Cell({ node, clipId, highlighted, onClick, onDoubleClick, onContextMenu }: CellProps) {
  // The picture of the character or shopkeeper, cut to the circle (D-024).
  const image = node.imageData ?? characterImage(node.characterId);
  const classes = [
    onClick || onDoubleClick ? styles.interactive : '',
    node.conqueredBy ? styles.conquered : '',
  ].join(' ');

  return (
    <g
      className={classes}
      data-node-id={node.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* The meaning of a special cell, in the director only: there the cells have a menu (spec 034). */}
      {onContextMenu && node.note && <title>{node.note}</title>}
      {/* Where a travel item can take the pawn (spec 047): a glowing ring around the cell. */}
      {highlighted && (
        <circle className={styles.reachable} cx={node.x} cy={node.y} r={node.radius + 7} />
      )}
      {/* Invisible larger target: small cells are easier to click. */}
      <circle
        className={styles.hit}
        cx={node.x}
        cy={node.y}
        r={Math.max(node.radius, CELL_HIT_RADIUS)}
      />
      {node.label === null ? (
        <circle
          className={node.role === 'special' ? styles.cellSpecial : styles.cellSmall}
          cx={node.x}
          cy={node.y}
          r={node.radius}
          style={node.color ? { fill: node.color } : undefined}
        />
      ) : image ? (
        <>
          <clipPath id={clipId}>
            <circle cx={node.x} cy={node.y} r={node.radius} />
          </clipPath>
          <circle className={styles.picture} cx={node.x} cy={node.y} r={node.radius} />
          <image
            className={styles.pictureImage}
            href={image}
            x={node.x - node.radius}
            y={node.y - node.radius}
            width={node.radius * 2}
            height={node.radius * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          <circle
            className={`${styles.frame} ${styles[node.role] ?? ''}`}
            cx={node.x}
            cy={node.y}
            r={node.radius}
          />
        </>
      ) : (
        <>
          <circle
            className={`${styles.placeholder} ${styles[node.role] ?? ''}`}
            cx={node.x}
            cy={node.y}
            r={node.radius}
          />
          <CellText node={node} label={node.label} />
        </>
      )}
    </g>
  );
}

function CellText({ node, label }: { node: NodeView; label: string }) {
  const lines = wrapLabel(label);
  const top = node.y - ((lines.length - 1) * LINE_HEIGHT) / 2 - (node.caption ? 7 : 0);
  return (
    <>
      <text className={styles.label}>
        {lines.map((line, index) => (
          <tspan key={index} x={node.x} y={top + index * LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
      {node.caption && (
        <text className={styles.caption} x={node.x} y={node.y + node.radius * 0.62}>
          {node.caption}
        </text>
      )}
    </>
  );
}

function menuHandler(open: (id: string, at: ScreenPoint) => void, id: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    open(id, { x: event.clientX, y: event.clientY });
  };
}

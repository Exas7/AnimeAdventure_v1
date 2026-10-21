import type {
  CellContent,
  Character,
  GameMap,
  GameState,
  MapEdge,
  MapNode,
  PlayerId,
  Point,
} from '../engine';

/** Board drawing width in SVG units; the height follows the background (16:9 without). */
export const BOARD_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;

export interface BoardSize {
  width: number;
  height: number;
}

/** Size of the board in SVG units: the proportions of the background image. */
export function boardSize(map: GameMap): BoardSize {
  const background = map.background;
  if (!background || background.width <= 0 || background.height <= 0) {
    return { width: BOARD_WIDTH, height: DEFAULT_HEIGHT };
  }
  return { width: BOARD_WIDTH, height: (BOARD_WIDTH * background.height) / background.width };
}

/** How a cell is drawn: from its type and from whether it holds a character (D-016). */
export type CellRole = 'passage' | 'character' | 'shop' | 'start' | 'special';

const ROLE_RADIUS: Record<CellRole, number> = {
  passage: 10,
  special: 16,
  start: 36,
  character: 48,
  shop: 48,
};

/**
 * The pawn is a little figure standing on its cell (spec 016). Its point is
 * where the feet touch the board; the head, the round pawn of before with
 * the initial, sits above the body.
 */
export const PAWN_HEAD_RADIUS = 18;
/** Height of the head centre above the feet. */
export const PAWN_HEAD_Y = 54;
/** Half the width of the figure, arms included. */
export const PAWN_HALF_WIDTH = 25;
/** Body, arms and legs around the feet point (0, 0), in board units. */
export const PAWN_BODY_PATH =
  'M -17 0 L -5 0 L 0 -9 L 5 0 L 17 0 L 10 -21 L 22 -26 Q 27 -28 25 -33 Q 23 -38 17 -39 ' +
  'L 0 -41 L -17 -39 Q -23 -38 -25 -33 Q -27 -28 -22 -26 L -10 -21 Z';

/** Small cells get a larger invisible target, so they are easy to click or drop on. */
export const CELL_HIT_RADIUS = 26;

export interface NodeView {
  id: string;
  role: CellRole;
  x: number;
  y: number;
  radius: number;
  /** Text inside large cells (placeholder name), or null for small cells. */
  label: string | null;
  /** Small caption under the label, e.g. "Negozio". */
  caption: string | null;
  conqueredBy: PlayerId | null;
  /** Special cells: colour chosen in the editor. */
  color: string | null;
  /** Special cells: the meaning written in the editor, shown only in the director (spec 034). */
  note?: string;
  /** The character shown in the cell (a shop's shopkeeper too), for its image (D-024). */
  characterId: string | null;
  /** The picture of a special shopkeeper in the cell (D-035). */
  imageData?: string;
}

export interface EdgeView {
  id: string;
  path: string;
  /** Closed for the viewer: drawn grey (D-006). */
  closed: boolean;
  lockNote: string | null;
}

export interface PawnView {
  player: PlayerId;
  /** The cell where the pawn stands. */
  nodeId: string;
  /** Where the feet touch the board. */
  x: number;
  y: number;
  label: string;
  isCurrent: boolean;
}

export interface BoardView {
  size: BoardSize;
  /** Background image (data URL), or null. */
  background: string | null;
  nodes: NodeView[];
  edges: EdgeView[];
  pawns: PawnView[];
}

/** The board as seen by `viewer`: paths closed for them and conquered cells are grey (D-006). */
export function boardView(
  map: GameMap,
  catalog: Character[],
  state: GameState,
  viewer: PlayerId,
): BoardView {
  const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  const size = boardSize(map);
  const toBoard = (point: Point): Point => ({ x: point.x * size.width, y: point.y * size.height });
  return {
    ...layoutView(map, catalog, state.cells, {
      conquests: state.conquests,
      isClosed: (edge) => state.edgeLocks[edge.id]?.[viewer] ?? edge.locked,
    }),
    pawns: pawnViews(state, nodesById, toBoard),
  };
}

/**
 * The board before a game (spec 007): cells drawn with their content as on
 * the stream, nothing conquered, paths locked as in the map, no pawns.
 */
export function contentView(
  map: GameMap,
  catalog: Character[],
  cells: Record<string, CellContent>,
): BoardView {
  return {
    ...layoutView(map, catalog, cells, { conquests: {}, isClosed: (edge) => edge.locked }),
    pawns: [],
  };
}

function layoutView(
  map: GameMap,
  catalog: Character[],
  cells: Record<string, CellContent>,
  status: { conquests: Partial<Record<string, PlayerId>>; isClosed: (edge: MapEdge) => boolean },
): Omit<BoardView, 'pawns'> {
  const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  const size = boardSize(map);
  const toBoard = (point: Point): Point => ({ x: point.x * size.width, y: point.y * size.height });

  const nodes = map.nodes.map((node): NodeView => {
    const content = cells[node.id];
    const role = cellRole(node, content);
    const { label, caption } = cellText(node, content, catalog);
    return {
      id: node.id,
      role,
      ...toBoard(node),
      radius: ROLE_RADIUS[role],
      label,
      caption,
      conqueredBy: status.conquests[node.id] ?? null,
      color: node.type === 'special' ? (node.color ?? null) : null,
      ...(node.type === 'special' && node.note?.trim() ? { note: node.note.trim() } : {}),
      characterId: role === 'character' || role === 'shop' ? (content?.characterId ?? null) : null,
      ...withImage(role === 'character' || role === 'shop' ? content?.characterId : undefined, catalog),
    };
  });

  const edges = map.edges.flatMap((edge): EdgeView[] => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) {
      return [];
    }
    const points = [toBoard(from), ...edge.curve.map(toBoard), toBoard(to)];
    return [
      {
        id: edge.id,
        path: edgePath(points),
        closed: status.isClosed(edge),
        lockNote: edge.lockNote ?? null,
      },
    ];
  });

  return { size, background: map.background?.image ?? null, nodes, edges };
}

/**
 * How a cell looks: a character cell is large with its character and a plain
 * passage without one (D-023). A character on another cell (games saved
 * before D-023) is still drawn large.
 */
export function cellRole(node: MapNode, content: CellContent | undefined): CellRole {
  switch (node.type) {
    case 'shop':
      return 'shop';
    case 'character':
      return content?.characterId ? 'character' : 'passage';
    case 'start':
      return content?.characterId ? 'character' : 'start';
    case 'special':
    case 'empty':
      if (content?.characterId) {
        return 'character';
      }
      return node.type === 'special' ? 'special' : 'passage';
  }
}

/**
 * SVG path through all the points: a straight line for two points, a smooth
 * curve (Catmull-Rom) passing through every point otherwise.
 */
export function edgePath(points: Point[]): string {
  const [first] = points;
  if (!first || points.length < 2) {
    return '';
  }
  let path = `M ${num(first.x)} ${num(first.y)}`;
  if (points.length === 2) {
    const last = points[1] as Point;
    return `${path} L ${num(last.x)} ${num(last.y)}`;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C ${num(c1.x)} ${num(c1.y)} ${num(c2.x)} ${num(c2.y)} ${num(p2.x)} ${num(p2.y)}`;
  }
  return path;
}

/** Splits a name into at most three short lines to fit inside a cell. */
export function wrapLabel(text: string, maxChars = 11): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  if (lines.length <= 3) {
    return lines;
  }
  return [...lines.slice(0, 2), `${lines.slice(2).join(' ').slice(0, maxChars - 1)}…`];
}

/** Short text on a pawn: short names as they are, otherwise the initial. */
export function pawnLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.length <= 3 ? trimmed : trimmed.charAt(0).toUpperCase();
}

function pawnViews(
  state: GameState,
  nodesById: Map<string, MapNode>,
  toBoard: (point: Point) => Point,
): PawnView[] {
  const players: PlayerId[] = ['p1', 'p2'];
  const together = state.players.p1.position === state.players.p2.position;

  return players.flatMap((playerId, index): PawnView[] => {
    const player = state.players[playerId];
    const node = nodesById.get(player.position);
    if (!node) {
      return [];
    }
    const center = toBoard(node);
    const radius = ROLE_RADIUS[cellRole(node, state.cells[node.id])];
    // On large cells the pawn stands on the upper part, leaving the name visible.
    const lift = radius > 20 ? radius * 0.55 : 0;
    // Two pawns on the same cell stand side by side.
    const shift = together ? (index === 0 ? -1 : 1) * (PAWN_HALF_WIDTH + 2) : 0;
    return [
      {
        player: playerId,
        nodeId: node.id,
        x: center.x + shift,
        y: center.y - lift,
        label: pawnLabel(player.name),
        isCurrent: state.currentPlayer === playerId,
      },
    ];
  });
}

/**
 * The cell a dragged pawn would land on (spec 016): the nearest one whose
 * target contains the point, or null when the point is away from all cells.
 */
export function nodeAtPoint(nodes: NodeView[], point: Point): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    if (distance <= Math.max(node.radius, CELL_HIT_RADIUS) && (!best || distance < best.distance)) {
      best = { id: node.id, distance };
    }
  }
  return best?.id ?? null;
}

/** The picture a special shopkeeper carries (D-035); nothing for the others. */
function withImage(characterId: string | undefined, catalog: Character[]): { imageData?: string } {
  const imageData = catalog.find((character) => character.id === characterId)?.imageData;
  return imageData ? { imageData } : {};
}

function cellText(
  node: MapNode,
  content: CellContent | undefined,
  catalog: Character[],
): { label: string | null; caption: string | null } {
  const character = catalog.find((candidate) => candidate.id === content?.characterId);
  if (node.type === 'shop') {
    // Without a shopkeeper the cell just says "Negozio", once.
    return character
      ? { label: character.name, caption: 'Negozio' }
      : { label: 'Negozio', caption: null };
  }
  if (character) {
    return { label: character.name, caption: node.type === 'start' ? 'Partenza' : null };
  }
  return { label: node.type === 'start' ? 'Partenza' : null, caption: null };
}

function num(value: number): number {
  return Math.round(value * 10) / 10;
}

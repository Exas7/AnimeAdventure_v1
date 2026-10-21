import {
  cellNumber,
  type GameMap,
  type MapBackground,
  type MapEdge,
  type MapNode,
  type NodeType,
  type Point,
} from '../engine';

// Map editing operations (spec 006). Each one returns a new map and leaves
// the given one untouched, so the editor can undo by keeping old maps.
// Coordinates are relative to the background: 0 to 1 on both axes.

export interface Selection {
  nodes: string[];
  edges: string[];
}

export const NO_SELECTION: Selection = { nodes: [], edges: [] };

export function newMap(name = 'Nuova mappa'): GameMap {
  return { name, nodes: [], edges: [] };
}

/** First free id like "n14", after the highest "n<number>" already used. */
export function nextId(prefix: 'n' | 'e', used: Iterable<string>): string {
  let highest = 0;
  for (const id of used) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `${prefix}${highest + 1}`;
}

export function addNode(
  map: GameMap,
  point: Point,
  type: NodeType,
): { map: GameMap; nodeId: string } {
  const nodeId = nextId('n', map.nodes.map((node) => node.id));
  const node: MapNode = { id: nodeId, ...clampPoint(point), type };
  return { map: { ...map, nodes: [...map.nodes, node] }, nodeId };
}

/** Adds a path between two cells; null if it would join a cell to itself or repeat a path. */
export function connect(
  map: GameMap,
  from: string,
  to: string,
): { map: GameMap; edgeId: string } | null {
  if (from === to || findEdgeBetween(map, from, to)) {
    return null;
  }
  const edgeId = nextId('e', map.edges.map((edge) => edge.id));
  const edge: MapEdge = { id: edgeId, from, to, curve: [], locked: false };
  return { map: { ...map, edges: [...map.edges, edge] }, edgeId };
}

export function findEdgeBetween(map: GameMap, a: string, b: string): MapEdge | undefined {
  return map.edges.find(
    (edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a),
  );
}

/**
 * Removes the selected cells (with their paths) and the selected paths.
 * Paths opened by a removed cell lose that link (D-027).
 */
export function deleteSelection(map: GameMap, selection: Selection): GameMap {
  const nodes = new Set(selection.nodes);
  const edges = new Set(selection.edges);
  return {
    ...map,
    nodes: map.nodes.filter((node) => !nodes.has(node.id)),
    edges: map.edges
      .filter((edge) => !edges.has(edge.id) && !nodes.has(edge.from) && !nodes.has(edge.to))
      .map((edge) =>
        edge.unlockNodeId !== undefined && nodes.has(edge.unlockNodeId)
          ? withoutUnlock(edge)
          : edge,
      ),
  };
}

/** Moves cells by the same amount; curve points of paths between them move too. */
export function moveNodes(map: GameMap, nodeIds: string[], delta: Point): GameMap {
  const moving = new Set(nodeIds);
  return {
    ...map,
    nodes: map.nodes.map((node) =>
      moving.has(node.id) ? { ...node, ...clampPoint(add(node, delta)) } : node,
    ),
    edges: map.edges.map((edge) =>
      moving.has(edge.from) && moving.has(edge.to)
        ? { ...edge, curve: edge.curve.map((point) => clampPoint(add(point, delta))) }
        : edge,
    ),
  };
}

/**
 * Copies the selected cells and the paths between them, shifted by `offset`,
 * with new ids. A copied path opened by a copied cell points to the copy.
 */
export function duplicateSelection(
  map: GameMap,
  selection: Selection,
  offset: Point,
): { map: GameMap; selection: Selection } {
  const usedNodes = map.nodes.map((node) => node.id);
  const usedEdges = map.edges.map((edge) => edge.id);
  const copies = new Map<string, string>();
  const newNodes: MapNode[] = [];

  for (const node of map.nodes.filter((candidate) => selection.nodes.includes(candidate.id))) {
    const id = nextId('n', usedNodes);
    usedNodes.push(id);
    copies.set(node.id, id);
    newNodes.push({ ...node, id, ...clampPoint(add(node, offset)) });
  }

  const newEdges: MapEdge[] = [];
  for (const edge of map.edges) {
    const from = copies.get(edge.from);
    const to = copies.get(edge.to);
    if (from && to) {
      const id = nextId('e', usedEdges);
      usedEdges.push(id);
      const unlockNodeId =
        edge.unlockNodeId === undefined
          ? undefined
          : (copies.get(edge.unlockNodeId) ?? edge.unlockNodeId);
      newEdges.push({
        ...edge,
        id,
        from,
        to,
        curve: edge.curve.map((point) => clampPoint(add(point, offset))),
        ...(unlockNodeId === undefined ? {} : { unlockNodeId }),
      });
    }
  }

  return {
    map: { ...map, nodes: [...map.nodes, ...newNodes], edges: [...map.edges, ...newEdges] },
    selection: { nodes: newNodes.map((node) => node.id), edges: newEdges.map((edge) => edge.id) },
  };
}

export function updateNodes(
  map: GameMap,
  nodeIds: string[],
  changes: Partial<Pick<MapNode, 'type' | 'color' | 'note'>>,
): GameMap {
  const targets = new Set(nodeIds);
  return {
    ...map,
    nodes: map.nodes.map((node) => (targets.has(node.id) ? withoutEmpty({ ...node, ...changes }) : node)),
  };
}

/**
 * Changes a path. Only a locked path can have a cell that opens it (D-027):
 * unlocking the path drops the link.
 */
export function updateEdge(
  map: GameMap,
  edgeId: string,
  changes: Partial<Pick<MapEdge, 'locked' | 'lockNote' | 'unlockNodeId'>>,
): GameMap {
  return {
    ...map,
    edges: map.edges.map((edge) => {
      if (edge.id !== edgeId) {
        return edge;
      }
      const changed = withoutEmpty({ ...edge, ...changes });
      return changed.locked ? changed : withoutUnlock(changed);
    }),
  };
}

/** Inserts a curve point at `index` (0 = right after the starting cell). */
export function addCurvePoint(map: GameMap, edgeId: string, index: number, point: Point): GameMap {
  return mapCurve(map, edgeId, (curve) => [
    ...curve.slice(0, index),
    clampPoint(point),
    ...curve.slice(index),
  ]);
}

export function moveCurvePoint(map: GameMap, edgeId: string, index: number, point: Point): GameMap {
  return mapCurve(map, edgeId, (curve) =>
    curve.map((current, i) => (i === index ? clampPoint(point) : current)),
  );
}

export function removeCurvePoint(map: GameMap, edgeId: string, index: number): GameMap {
  return mapCurve(map, edgeId, (curve) => curve.filter((_, i) => i !== index));
}

export function clearCurve(map: GameMap, edgeId: string): GameMap {
  return mapCurve(map, edgeId, () => []);
}

export function setBackground(map: GameMap, background: MapBackground | undefined): GameMap {
  const { background: _previous, ...rest } = map;
  return background ? { ...rest, background } : rest;
}

export function renameMap(map: GameMap, name: string): GameMap {
  return { ...map, name };
}

/**
 * Name for a new version of a map (spec 015): "Nameck" → "Nameck 2",
 * "Nameck 2" → "Nameck 3", skipping names already in the library.
 */
export function nextVersionName(name: string, existing: string[]): string {
  const match = /^(.*?)\s*(\d+)$/.exec(name.trim());
  const base = (match ? match[1] : name.trim()) || 'Mappa';
  const taken = new Set(existing.map((entry) => entry.trim().toLowerCase()));
  let number = match ? Number(match[2]) + 1 : 2;
  while (taken.has(`${base} ${number}`.toLowerCase())) {
    number += 1;
  }
  return `${base} ${number}`;
}

/** After undo the selection may refer to removed elements: keep only existing ones. */
export function existingSelection(map: GameMap, selection: Selection): Selection {
  const nodes = new Set(map.nodes.map((node) => node.id));
  const edges = new Set(map.edges.map((edge) => edge.id));
  return {
    nodes: selection.nodes.filter((id) => nodes.has(id)),
    edges: selection.edges.filter((id) => edges.has(id)),
  };
}

/** Cells inside the rectangle between two corners. */
export function nodesInRect(map: GameMap, a: Point, b: Point): string[] {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  return map.nodes
    .filter((node) => node.x >= left && node.x <= right && node.y >= top && node.y <= bottom)
    .map((node) => node.id);
}

export type MapIssueKind =
  | 'fewShops'
  | 'startCount'
  | 'isolated'
  | 'unreachable'
  | 'startNeighbours'
  | 'deadEnds'
  | 'roadWithoutOpener'
  | 'roadOpenerWrong'
  | 'roadNotDeadEnd';

export interface MapIssue {
  kind: MapIssueKind;
  message: string;
}

/** Guides for the editor (D-008): they never prevent saving. */
export function checkMap(map: GameMap): MapIssue[] {
  const issues: MapIssue[] = [];
  const shops = map.nodes.filter((node) => node.type === 'shop').length;
  const starts = map.nodes.filter((node) => node.type === 'start');

  if (shops < 2) {
    issues.push({ kind: 'fewShops', message: `Negozi: ${shops}. Ne servono almeno 2.` });
  }
  if (starts.length !== 2) {
    issues.push({ kind: 'startCount', message: `Partenze: ${starts.length}. Ne servono 2.` });
  }

  const linked = new Set(map.edges.flatMap((edge) => [edge.from, edge.to]));
  const isolated = map.nodes
    .filter((node) => !linked.has(node.id))
    .map((node) => cellNumber(node.id));
  if (isolated.length > 0) {
    issues.push({ kind: 'isolated', message: `Caselle senza percorsi: ${isolated.join(', ')}.` });
  }

  if (starts.length > 0) {
    const reached = reachableFrom(map, starts.map((node) => node.id));
    const unreachable = map.nodes
      .filter((node) => !reached.has(node.id) && linked.has(node.id))
      .map((node) => cellNumber(node.id));
    if (unreachable.length > 0) {
      issues.push({
        kind: 'unreachable',
        message: `Caselle non raggiungibili da una partenza: ${unreachable.join(', ')}.`,
      });
    }
  }

  // Between a start and any cell that is not a passage there is at least one
  // passage cell (spec 014).
  const types = new Map(map.nodes.map((node) => [node.id, node.type]));
  const tooClose = map.edges
    .map((edge) =>
      types.get(edge.from) === 'start'
        ? [edge.from, edge.to]
        : types.get(edge.to) === 'start'
          ? [edge.to, edge.from]
          : null,
    )
    .filter((pair): pair is string[] => pair !== null && types.get(pair[1] as string) !== 'empty')
    .map(([start, other]) => `${cellNumber(start as string)}–${cellNumber(other as string)}`);
  if (tooClose.length > 0) {
    issues.push({
      kind: 'startNeighbours',
      message:
        `Partenze attaccate ad altre caselle: ${tooClose.join(', ')}. Tra una partenza e ` +
        'qualsiasi casella che non sia di passaggio ci vuole almeno un pallino.',
    });
  }
  issues.push(...checkRoads(map, linked));
  return issues;
}

/**
 * The map rules of D-051: no cell is a dead end, except a Character cell
 * behind a grey road; a grey road opens from the Character cell at its
 * start and leads to a Character cell at the end of a dead end.
 */
function checkRoads(map: GameMap, linked: Set<string>): MapIssue[] {
  const issues: MapIssue[] = [];
  const types = new Map(map.nodes.map((node) => [node.id, node.type]));
  const paths = (id: string) => map.edges.filter((edge) => edge.from === id || edge.to === id);
  const road = (edge: MapEdge) => `${cellNumber(edge.from)}–${cellNumber(edge.to)}`;

  const deadEnds = map.nodes
    .filter((node) => node.type !== 'start' && linked.has(node.id))
    .filter((node) => {
      const own = paths(node.id);
      const behindRoad = node.type === 'character' && own.length === 1 && own[0]?.locked === true;
      return !behindRoad && own.filter((edge) => !edge.locked).length < 2;
    })
    .map((node) => cellNumber(node.id));
  if (deadEnds.length > 0) {
    issues.push({
      kind: 'deadEnds',
      message:
        `Vicoli ciechi: ${deadEnds.join(', ')}. Solo una casella personaggio dietro una strada ` +
        'grigia può esserlo.',
    });
  }

  const withoutOpener: string[] = [];
  const openerWrong: string[] = [];
  const notDeadEnd: string[] = [];
  for (const edge of map.edges.filter((entry) => entry.locked)) {
    const opener = edge.unlockNodeId;
    if (opener === undefined || !types.has(opener)) {
      withoutOpener.push(road(edge));
      continue;
    }
    const behind = opener === edge.from ? edge.to : opener === edge.to ? edge.from : undefined;
    if (behind === undefined || types.get(opener) !== 'character') {
      openerWrong.push(road(edge));
    }
    if (behind !== undefined && (types.get(behind) !== 'character' || paths(behind).length !== 1)) {
      notDeadEnd.push(road(edge));
    }
  }
  if (withoutOpener.length > 0) {
    issues.push({
      kind: 'roadWithoutOpener',
      message: `Strade grigie senza la casella che le apre: ${withoutOpener.join(', ')}.`,
    });
  }
  if (openerWrong.length > 0) {
    issues.push({
      kind: 'roadOpenerWrong',
      message:
        `Strade grigie che non si aprono dalla casella personaggio al loro inizio: ${openerWrong.join(', ')}.`,
    });
  }
  if (notDeadEnd.length > 0) {
    issues.push({
      kind: 'roadNotDeadEnd',
      message:
        'Strade grigie che non portano a una casella personaggio in fondo a un vicolo cieco: ' +
        `${notDeadEnd.join(', ')}.`,
    });
  }
  return issues;
}

/** Cells reachable from the given ones along any path, locked or not. */
function reachableFrom(map: GameMap, startIds: string[]): Set<string> {
  const reached = new Set(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of map.edges) {
      const other = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (other !== null && !reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    }
  }
  return reached;
}

function mapCurve(map: GameMap, edgeId: string, change: (curve: Point[]) => Point[]): GameMap {
  return {
    ...map,
    edges: map.edges.map((edge) => (edge.id === edgeId ? { ...edge, curve: change(edge.curve) } : edge)),
  };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Keeps points on the map and rounds them, so files stay readable. */
function clampPoint(point: Point): Point {
  const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
  return { x: clamp(point.x), y: clamp(point.y) };
}

/** Drops empty optional texts (e.g. a cleared note) instead of keeping "". */
function withoutEmpty<T extends object>(value: T): T {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of ['color', 'note', 'lockNote', 'unlockNodeId']) {
    if (copy[key] === '' || copy[key] === undefined) {
      delete copy[key];
    }
  }
  return copy as T;
}

function withoutUnlock(edge: MapEdge): MapEdge {
  const { unlockNodeId: _dropped, ...rest } = edge;
  return rest;
}

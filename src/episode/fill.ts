import { onePerPerson, personOf, personsOf } from '../catalog/person';
import type { CellContent, Character, GameMap } from '../engine';
import type { TextLibrary } from './textLibrary';

// Random filling of an episode (spec 007, 2.4). The source of random numbers
// comes from outside, so tests can repeat a draw exactly.

/** Returns a number in [0, 1), like Math.random. */
export type Random = () => number;

export type Content = Record<string, CellContent>;

/** What "Randomizza" did, for the message in the editor (spec 022). */
export interface RandomizeResult {
  content: Content;
  /** Character cells that got a character, and those left without one. */
  cellsFilled: number;
  cellsLeftEmpty: number;
  /** Shops among the chosen cells. */
  shops: number;
  /** Places for sale filled, and those left empty for lack of characters. */
  forSaleFilled: number;
  forSaleLeftEmpty: number;
  /** Shops that kept their shopkeeper because no free one was left. */
  keepersKept: number;
}

const TIER_LETTERS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];

/** Strength order of a tier: E is the lowest, SS+ the highest; null if unknown or missing. */
export function tierRank(tier: string | undefined): number | null {
  const match = /^(SS|S|A|B|C|D|E)([+-]?)$/.exec((tier ?? '').trim().toUpperCase());
  if (!match) {
    return null;
  }
  const step = match[2] === '+' ? 1 : match[2] === '-' ? -1 : 0;
  return TIER_LETTERS.indexOf(match[1] as string) * 3 + step;
}

/**
 * Steps from the nearest start cell, along any path (locked ones too).
 * Unreachable cells get Infinity: they count as the farthest.
 */
export function distancesFromStarts(map: GameMap): Map<string, number> {
  const distances = new Map<string, number>(map.nodes.map((node) => [node.id, Infinity]));
  const queue = map.nodes.filter((node) => node.type === 'start').map((node) => node.id);
  for (const id of queue) {
    distances.set(id, 0);
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const next = (distances.get(current) ?? 0) + 1;
    for (const edge of map.edges) {
      const other = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (other !== null && (distances.get(other) ?? Infinity) > next) {
        distances.set(other, next);
        queue.push(other);
      }
    }
  }
  return distances;
}

/** Characters already in the episode: in a cell (shopkeepers too) or for sale. */
export function usedCharacters(content: Content): Set<string> {
  const used = new Set<string>();
  for (const cell of Object.values(content)) {
    if (cell.characterId) {
      used.add(cell.characterId);
    }
    for (const id of cell.forSale ?? []) {
      used.add(id);
    }
  }
  return used;
}

/** The weakest tier "Randomizza" puts in cells and shops (spec 022). */
const LOWEST_RANK = tierRank('C-') as number;

/**
 * Who "Randomizza" can put in a cell or up for sale (D-034): a recruitable
 * character, so with a tier, from C- up, that does not keep shops.
 */
export function canBeDrawn(character: Character): boolean {
  const rank = tierRank(character.tier);
  return rank !== null && rank >= LOWEST_RANK && !character.shopkeeper;
}

/**
 * The order in which the drawn characters go, weakest first (spec 022,
 * 2.1). Each cell belongs to its nearest start, counting open paths only;
 * the cells of the sides are paired by distance (the nearest of one side
 * with the nearest of the other, and so on), and a cell as far from two
 * starts stands alone. Cells reached only through a locked path come in
 * `locked`, the farthest last: they get the strongest.
 */
export function placementOrder(
  map: GameMap,
  cellIds: string[],
): { open: string[][]; locked: string[] } {
  const starts = map.nodes.filter((node) => node.type === 'start').map((node) => node.id);
  const fromStarts = starts.map((id) => openDistances(map, id));
  const sides: { id: string; distance: number }[][] = starts.map(() => []);
  const groups: { ids: string[]; distance: number }[] = [];
  const locked: string[] = [];

  for (const id of cellIds) {
    const distances = fromStarts.map((distance) => distance.get(id) ?? Infinity);
    const nearest = Math.min(Infinity, ...distances);
    if (nearest === Infinity) {
      locked.push(id);
      continue;
    }
    const owners = distances.flatMap((distance, index) => (distance === nearest ? [index] : []));
    const side = owners.length === 1 ? sides[owners[0] as number] : undefined;
    if (side) {
      side.push({ id, distance: nearest });
    } else {
      groups.push({ ids: [id], distance: nearest });
    }
  }

  sides.forEach((side) => side.sort((a, b) => a.distance - b.distance));
  const longest = Math.max(0, ...sides.map((side) => side.length));
  for (let index = 0; index < longest; index++) {
    const members = sides.flatMap((side) => {
      const member = side[index];
      return member ? [member] : [];
    });
    groups.push({
      ids: members.map((member) => member.id),
      distance: Math.max(...members.map((member) => member.distance)),
    });
  }
  groups.sort((a, b) => a.distance - b.distance);

  const anyPath = distancesFromStarts(map);
  locked.sort((a, b) => (anyPath.get(a) ?? Infinity) - (anyPath.get(b) ?? Infinity));
  return { open: groups.map((group) => group.ids), locked };
}

/**
 * Of the given cells, those that open a locked path (D-027) and can be
 * reached along open paths, nearest first: they get strong characters and
 * hard missions (D-052).
 */
export function openingCells(map: GameMap, cellIds: string[]): string[] {
  const openers = new Set(
    map.edges.flatMap((edge) => (edge.locked && edge.unlockNodeId ? [edge.unlockNodeId] : [])),
  );
  const starts = map.nodes.filter((node) => node.type === 'start').map((node) => node.id);
  const fromStarts = starts.map((id) => openDistances(map, id));
  const nearest = (id: string) => Math.min(Infinity, ...fromStarts.map((distances) => distances.get(id) ?? Infinity));
  return cellIds
    .filter((id) => openers.has(id) && nearest(id) !== Infinity)
    .sort((a, b) => nearest(a) - nearest(b));
}

/**
 * "Randomizza" (spec 022) on the chosen cells. Character cells get
 * characters never used in the episode, from C- up (D-034), placed by
 * `placementOrder`; a cell without lines gets one from the library, and
 * lines already written stay (D-031). Shops get a shopkeeper, a different
 * one for each shop while there are free ones, from the list or the
 * special ones (D-035), and `perShop` characters for sale: with a price,
 * from C- up, never used. A chosen Character cell left without a character
 * loses its mission and lines too (spec 034). Other chosen cells are left
 * alone. `reserved`
 * characters never go anywhere: the starters proposed in the episode
 * (spec 028, D-044).
 */
export function randomize(
  map: GameMap,
  content: Content,
  catalog: Character[],
  specialKeepers: Character[],
  texts: TextLibrary,
  nodeIds: string[],
  perShop: number,
  random: Random,
  reserved: readonly string[] = [],
): RandomizeResult {
  const types = new Map(map.nodes.map((node) => [node.id, node.type]));
  const cellTargets = nodeIds.filter((id) => types.get(id) === 'character');
  const shopTargets = nodeIds.filter((id) => types.get(id) === 'shop');

  // What the chosen cells hold now is being replaced: those characters are
  // free again. A cell that gets nothing stays empty, so nobody appears twice.
  const result: Content = { ...content };
  const oldKeepers = new Map<string, string | undefined>();
  for (const id of cellTargets) {
    setCell(result, id, { ...result[id], characterId: undefined });
  }
  for (const id of shopTargets) {
    oldKeepers.set(id, result[id]?.characterId);
    setCell(result, id, { ...result[id], characterId: undefined, forSale: undefined });
  }
  const used = usedCharacters(result);
  for (const id of reserved) {
    used.add(id);
  }
  // One person in one place (spec 039): no other form of anyone already used.
  const usedPersons = personsOf(used, [...catalog, ...specialKeepers]);

  // Characters for the cells, weakest first, to follow `placementOrder`.
  const drawn = onePerPerson(
    shuffle(
      catalog.filter((character) => canBeDrawn(character) && !used.has(character.id)),
      random,
    ),
    usedPersons,
  )
    .slice(0, cellTargets.length)
    .map((character) => ({ character, rank: tierRank(character.tier) as number }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.character);
  const opening = openingCells(map, cellTargets);
  const { open, locked } = placementOrder(
    map,
    cellTargets.filter((id) => !opening.includes(id)),
  );
  // The strongest go behind the locked paths, the very strongest farthest.
  const strongest = drawn.splice(Math.max(0, drawn.length - locked.length));
  const placed: [string, Character][] = strongest.map((character, index) => [
    locked[locked.length - strongest.length + index] as string,
    character,
  ]);
  // The next ones open those paths (D-052), the stronger the farther.
  const openers = drawn.splice(Math.max(0, drawn.length - opening.length));
  openers.forEach((character, index) =>
    placed.push([opening[opening.length - openers.length + index] as string, character]),
  );
  // Inside a pair, who gets the slightly stronger one is left to chance.
  const openCells = open.flatMap((group) => shuffle(group, random));
  drawn.forEach((character, index) => placed.push([openCells[index] as string, character]));

  // A cell that got nobody keeps no mission or lines of the one who was there.
  const filled = new Set(placed.map(([cellId]) => cellId));
  for (const id of cellTargets.filter((cellId) => !filled.has(cellId))) {
    const { mission: _mission, lines: _lines, format: _format, ...rest } = result[id] ?? {};
    setCell(result, id, rest);
  }

  for (const [cellId, character] of placed) {
    const previous = result[cellId] ?? {};
    const drawnLine = previous.lines?.length ? undefined : pick(texts.lines, random);
    setCell(result, cellId, {
      ...previous,
      characterId: character.id,
      lines: drawnLine === undefined ? previous.lines : [drawnLine],
    });
    used.add(character.id);
    usedPersons.add(personOf(character));
  }

  // Shopkeepers: a free one for each shop; without, the shop keeps its own if still free.
  const keepers = shuffle(
    [...catalog.filter((character) => character.shopkeeper), ...specialKeepers],
    random,
  );
  let keepersKept = 0;
  const personOfKeeper = (keeperId: string) => [...personsOf([keeperId], [...catalog, ...specialKeepers])][0];
  const isFree = (keeperId: string) => !used.has(keeperId) && !usedPersons.has(personOfKeeper(keeperId) as string);
  for (const id of shopTargets) {
    const free = keepers.find((keeper) => isFree(keeper.id));
    const old = oldKeepers.get(id);
    const keeper = free?.id ?? (old !== undefined && isFree(old) ? old : undefined);
    if (!free && keeper !== undefined) {
      keepersKept += 1;
    }
    if (keeper !== undefined) {
      used.add(keeper);
      usedPersons.add(personOfKeeper(keeper) as string);
    }
    setCell(result, id, { ...result[id], characterId: keeper });
  }

  // Characters for sale: with a price, from C- up, never used, one form per person.
  const forSale = onePerPerson(
    shuffle(
      catalog.filter(
        (character) =>
          canBeDrawn(character) && character.price !== undefined && !used.has(character.id),
      ),
      random,
    ),
    usedPersons,
  );
  let forSaleFilled = 0;
  for (const id of shopTargets) {
    const sold = forSale.splice(0, Math.max(0, perShop)).map((character) => character.id);
    forSaleFilled += sold.length;
    setCell(result, id, { ...result[id], forSale: sold });
  }

  return {
    content: result,
    cellsFilled: placed.length,
    cellsLeftEmpty: cellTargets.length - placed.length,
    shops: shopTargets.length,
    forSaleFilled,
    forSaleLeftEmpty: shopTargets.length * Math.max(0, perShop) - forSaleFilled,
    keepersKept,
  };
}

/** Empties the chosen cells completely. */
export function clearCells(content: Content, nodeIds: string[]): Content {
  const result = { ...content };
  for (const id of nodeIds) {
    delete result[id];
  }
  return result;
}

/** Steps from one start along open paths; the cells it cannot reach are missing. */
export function openDistances(map: GameMap, startId: string): Map<string, number> {
  const distances = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  for (const current of queue) {
    const next = (distances.get(current) ?? 0) + 1;
    for (const edge of map.edges) {
      const other = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (other !== null && !edge.locked && !distances.has(other)) {
        distances.set(other, next);
        queue.push(other);
      }
    }
  }
  return distances;
}

/** Writes a cell, or removes it when nothing is left in it. */
function setCell(content: Content, nodeId: string, cell: CellContent): void {
  const clean = withoutEmpty(cell);
  if (Object.keys(clean).length > 0) {
    content[nodeId] = clean;
  } else {
    delete content[nodeId];
  }
}

export function shuffle<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export function pick(items: string[], random: Random): string | undefined {
  return items.length === 0 ? undefined : items[Math.floor(random() * items.length)];
}

function withoutEmpty(content: CellContent): CellContent {
  const copy = { ...content } as Record<string, unknown>;
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined || copy[key] === '') {
      delete copy[key];
    }
  }
  return copy as CellContent;
}

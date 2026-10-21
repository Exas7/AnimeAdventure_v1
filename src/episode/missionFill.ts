import { onePerPerson, personsOf, samePerson } from '../catalog/person';
import {
  cellNumber,
  rewardText,
  type ChallengeFormat,
  type Character,
  type GameMap,
  type ItemDefinition,
  type Mission,
} from '../engine';
import {
  fillLines,
  groupMissions,
  hasOwnMissions,
  ownMissions,
  type CatalogMission,
  type QuestionEntry,
} from '../missions/catalog';
import {
  openDistances,
  openingCells,
  pick,
  randomize,
  shuffle,
  tierRank,
  usedCharacters,
  type Content,
  type Random,
  type RandomizeResult,
} from './fill';
import type { TextLibrary } from './textLibrary';

// "Randomizza" with the missions of the catalog (spec 027, 2.4): story
// characters on the map, chains on the locked paths, and a mission for each
// character that makes sense where it stands.

/** Where the missions come from: the catalog and the quiz library (D-041). */
export interface MissionSources {
  catalog: CatalogMission[];
  questions: QuestionEntry[];
  items: ItemDefinition[];
}

/** What "Randomizza" put on the map besides the characters to recruit (spec 033, 2.3). */
export type RandomExtra =
  /** A story character (D-042): only gives a mission. */
  | { kind: 'story'; characterId: string; cellId: string }
  /** Put in a cell because the mission of `forId` needs it. */
  | { kind: 'placed'; characterId: string; cellId: string; forId: string }
  /** A chain on a locked path (spec 027): the giver opens it, the other stands behind. */
  | { kind: 'chain'; giverId: string; cellId: string; behindId: string; behindCellId: string };

export interface MissionRandomizeResult extends RandomizeResult {
  /** Story characters put in character cells (D-042). */
  storyCharacters: number;
  /** Character cells that got a mission. */
  missions: number;
  /** Choices the host may want to check, e.g. a character moved for a mission. */
  notes: string[];
  /** The same choices, one by one, for the "Sfide extra" of "Nuova partita". */
  extras: RandomExtra[];
}

/** About one story character every so many character cells (spec 027, 2.4). */
export const CELLS_PER_STORY_CHARACTER = 8;

/** The only missions of a cell that opens a locked path: hard ones (D-052). */
const OPENER_MISSIONS: readonly Mission['type'][] = ['fight', 'defeat'];

/** Where a cell stands for the missions: its side, and how far along it. */
interface CellPlace {
  /** -1 for a cell as far from both starts: it belongs to neither side, as in `placementOrder`. */
  side: number;
  /** Steps along open paths; cells behind a locked path come after all the others. */
  distance: number;
  /** Among the nearest third of its side: the player still has only the starter. */
  firstThird: boolean;
  /** The farthest of its side: the only one that may hold a 3v3. */
  farthest: boolean;
  locked: boolean;
}

/**
 * "Randomizza" with missions. With an empty catalog it is the "Randomizza"
 * of spec 022, unchanged. `reserved` characters go nowhere, neither in
 * cells and shops nor as targets or rewards of missions: the starters
 * proposed in the episode (D-044).
 */
export function randomizeWithMissions(
  map: GameMap,
  content: Content,
  catalog: Character[],
  specialKeepers: Character[],
  texts: TextLibrary,
  nodeIds: string[],
  perShop: number,
  random: Random,
  sources: MissionSources,
  reserved: readonly string[] = [],
): MissionRandomizeResult {
  if (sources.catalog.length === 0) {
    const plain = randomize(map, content, catalog, specialKeepers, texts, nodeIds, perShop, random, reserved);
    return { ...plain, storyCharacters: 0, missions: 0, notes: [], extras: [] };
  }
  const types = new Map(map.nodes.map((node) => [node.id, node.type]));
  const cellTargets = nodeIds.filter((id) => types.get(id) === 'character');
  // Places, formats, targets and rewards look at the whole map, even when
  // only some cells are chosen; only the chosen ones change (spec 034).
  const characterCellIds = map.nodes.filter((node) => node.type === 'character').map((node) => node.id);
  const places = cellPlaces(map, characterCellIds);
  const openers = new Set(openingCells(map, characterCellIds));
  const find = (id: string | undefined) => catalog.find((character) => character.id === id);
  const name = (id: string | undefined) => find(id)?.name ?? id ?? '';
  const notes: string[] = [];
  const extras: RandomExtra[] = [];
  const isReserved = (id: string | undefined) => id !== undefined && reserved.includes(id);
  // One person in one place (spec 039, D-064): the persons of the starters proposed are taken too.
  const personOfCode = (id: string) => [...personsOf([id], catalog)][0] as string;
  const reservedPersons = personsOf(reserved, catalog);

  // The chosen character cells start empty: what they held is free again.
  const working: Content = { ...content };
  for (const id of cellTargets) {
    const { characterId: _old, ...rest } = working[id] ?? {};
    working[id] = rest;
  }

  // 1. Chains on the locked paths (spec 027, 2.4): the one who opens the path
  // in its cell, the stronger one behind. Decided before the draw, so that
  // the draw does not use them elsewhere.
  const chained = new Map<string, CatalogMission>();
  const chainCells = new Set<string>();
  const chainEntries = shuffle(
    sources.catalog.filter((entry) => entry.behindId && 'characterId' in entry.giver),
    random,
  );
  for (const edge of map.edges) {
    const key = edge.unlockNodeId;
    const behind = key === edge.from ? edge.to : key === edge.to ? edge.from : undefined;
    if (!edge.locked || !key || !behind) {
      continue;
    }
    const deadEnd = map.edges.filter((other) => other.from === behind || other.to === behind).length === 1;
    if (!deadEnd || !cellTargets.includes(key) || !cellTargets.includes(behind) || chainCells.has(key)) {
      continue;
    }
    const used = usedCharacters(working);
    const usedPersons = personsOf(used, catalog);
    // The two of a chain may be one person (D-066), never one already elsewhere.
    const entry = chainEntries.find((candidate) =>
      [giverId(candidate), candidate.behindId ?? ''].every(
        (id) =>
          find(id) &&
          !used.has(id) &&
          !usedPersons.has(personOfCode(id)) &&
          !isReserved(id) &&
          !reservedPersons.has(personOfCode(id)),
      ),
    );
    if (!entry?.behindId) {
      continue;
    }
    chainEntries.splice(chainEntries.indexOf(entry), 1);
    working[key] = { ...working[key], characterId: giverId(entry) };
    working[behind] = { ...working[behind], characterId: entry.behindId };
    chained.set(key, entry);
    chainCells.add(key).add(behind);
    notes.push(
      `Catena ${name(giverId(entry))} → ${name(entry.behindId)} sul percorso ${cellNumber(key)}–${cellNumber(behind)}.`,
    );
    extras.push({ kind: 'chain', giverId: giverId(entry), cellId: key, behindId: entry.behindId, behindCellId: behind });
  }

  // 2. Story characters (D-042): no tier, with missions of their own. A
  // shopkeeper too, when not keeping a shop in this episode (D-047).
  const usedBefore = usedCharacters(working);
  const personsBefore = personsOf(usedBefore, catalog);
  const storyPool = onePerPerson(
    shuffle(
      catalog.filter(
        (character) =>
          !character.tier &&
          !usedBefore.has(character.id) &&
          !isReserved(character.id) &&
          hasOwnMissions(character.id, sources.catalog),
      ),
      random,
    ),
    new Set([...personsBefore, ...reservedPersons]),
  );
  const storyCells = pickStoryCells(
    new Map([...places].filter(([id]) => cellTargets.includes(id))),
    // The cells that open a locked path get a strong character instead (D-052).
    new Set([...chainCells, ...openers]),
    Math.min(storyPool.length, Math.floor(cellTargets.length / CELLS_PER_STORY_CHARACTER)),
    random,
  );
  storyCells.forEach((cellId, index) => {
    working[cellId] = { ...working[cellId], characterId: storyPool[index]?.id };
  });

  // 3. The usual draw on the other cells and on the shops (spec 022). The
  // rewards promised by the cells not chosen are places too (D-066): the draw
  // leaves them, and their persons, out.
  const promised = Object.entries(working)
    .filter(([id]) => !cellTargets.includes(id))
    .flatMap(([, cell]) => cell.mission?.reward.characters ?? []);
  const drawn = randomize(
    map,
    working,
    catalog,
    specialKeepers,
    texts,
    nodeIds.filter((id) => !storyCells.includes(id) && !chainCells.has(id)),
    perShop,
    random,
    [...reserved, ...promised],
  );
  const result: Content = { ...drawn.content };

  // 4. A mission for each character, from the nearest cells to the farthest.
  const order = [...cellTargets].sort(
    (a, b) => (places.get(a)?.distance ?? 0) - (places.get(b)?.distance ?? 0),
  );
  const processed = new Set<string>();
  // Characters already promised as a reward of another mission, here or in the cells not chosen.
  const rewarded = new Set(
    Object.entries(result)
      .filter(([id]) => !cellTargets.includes(id))
      .flatMap(([, cell]) => cell.mission?.reward.characters ?? []),
  );
  // Cells whose character a mission needs where it is: the target of a
  // mission, or someone put there for one. Nobody else goes there.
  const pinned = new Set<string>();
  const usedQuestions = new Set(
    Object.entries(result)
      .filter(([id]) => !cellTargets.includes(id))
      .flatMap(([, cell]) => (cell.mission?.quiz ? [cell.mission.quiz.question] : [])),
  );
  let missions = 0;

  for (const cellId of order) {
    const character = find(result[cellId]?.characterId);
    const place = places.get(cellId);
    processed.add(cellId);
    if (!character || !place) {
      continue;
    }
    const own = chained.get(cellId);
    // Who opens a locked path gives a hard mission (D-052).
    const fits = (entry: CatalogMission) => !openers.has(cellId) || OPENER_MISSIONS.includes(entry.mission.type);
    // Their own missions first; if none fits here, those of their group.
    const candidates = own
      ? [[own]]
      : [
          ownMissions(character.id, sources.catalog).filter(fits),
          groupMissions(character, sources.catalog).filter(fits),
        ];
    let chosen: Planned | null = null;
    for (const group of candidates) {
      for (const entry of weightedOrder(group, random)) {
        chosen = plan(entry, cellId, place);
        if (chosen) {
          break;
        }
      }
      if (chosen) {
        break;
      }
    }
    if (!chosen && character.tier) {
      // Nothing fits: a plain fight, in the format of the distance.
      chosen = {
        mission: { type: 'fight', format: defaultFormat(place), condition: 'win', reward: { cellCharacter: true } },
        lines: [],
      };
    }
    if (!chosen) {
      // No mission fits: the cell keeps none of the one who was there before.
      const { mission: _gone, ...rest } = result[cellId] ?? {};
      result[cellId] = rest;
      continue;
    }
    if (chosen.replace) {
      result[chosen.replace.cellId] = { characterId: chosen.replace.characterId };
      pinned.add(chosen.replace.cellId);
      notes.push(
        `${name(chosen.replace.characterId)} messo nella casella ${cellNumber(chosen.replace.cellId)} per la missione di ${character.name}.`,
      );
      extras.push({
        kind: 'placed',
        characterId: chosen.replace.characterId,
        cellId: chosen.replace.cellId,
        forId: character.id,
      });
    }
    const targetId = chosen.mission.targetId;
    const targetCell = targetId
      ? characterCellIds.find((id) => result[id]?.characterId === targetId)
      : undefined;
    if (targetCell) {
      pinned.add(targetCell);
    }
    for (const id of chosen.mission.reward.characters ?? []) {
      rewarded.add(id);
    }
    if (chosen.mission.quiz) {
      usedQuestions.add(chosen.mission.quiz.question);
    }
    const values = {
      target: chosen.mission.targetId ? name(chosen.mission.targetId) : undefined,
      reward: rewardText(chosen.mission.reward, character.id, catalog, sources.items),
      turns: chosen.mission.turns,
      coins: chosen.mission.reward.coins,
    };
    const library = pick(texts.lines, random);
    const lines = chosen.lines.length > 0 ? fillLines(chosen.lines, values) : library ? [library] : [];
    const { lines: _old, format: _format, ...rest } = result[cellId] ?? {};
    result[cellId] = { ...rest, mission: chosen.mission, ...(lines.length > 0 ? { lines } : {}) };
    missions += 1;
  }

  if (storyCells.length > 0) {
    notes.unshift(
      `${storyCells.length} ${storyCells.length === 1 ? 'personaggio della storia' : 'personaggi della storia'}: ${storyCells
        .map((id) => `${name(result[id]?.characterId)} (${cellNumber(id)})`)
        .join(', ')}.`,
    );
  }
  const story = storyCells.flatMap((cellId): RandomExtra[] => {
    const characterId = result[cellId]?.characterId;
    return characterId ? [{ kind: 'story', characterId, cellId }] : [];
  });
  return {
    ...drawn,
    content: result,
    cellsFilled: drawn.cellsFilled + storyCells.length + chainCells.size,
    storyCharacters: storyCells.length,
    missions,
    notes,
    extras: [...story, ...extras],
  };

  /** The mission a catalog entry becomes in this cell, or null when it does not fit here. */
  function plan(entry: CatalogMission, cellId: string, place: CellPlace): Planned | null {
    const mission: Mission = JSON.parse(JSON.stringify(entry.mission)) as Mission;
    const onBoard = (id: string) =>
      Object.values(result).some((cell) => cell.characterId === id);
    const forSale = (id: string) => Object.values(result).some((cell) => cell.forSale?.includes(id));
    const characterCells = characterCellIds.filter((id) => id !== cellId && result[id]?.characterId);
    // A target chosen here is never another form of the giver (D-048).
    const giver = find(result[cellId]?.characterId);
    const notGiver = (id: string | undefined) => !samePerson(giver, find(id));
    let replace: Planned['replace'];
    // A person already in the game, on the board, for sale, promised or proposed as starter (spec 039).
    const takenPersons = personsOf(
      [
        ...Object.values(result).flatMap((cell) => [...(cell.characterId ? [cell.characterId] : []), ...(cell.forSale ?? [])]),
        ...rewarded,
        ...reserved,
      ],
      catalog,
    );
    const personTaken = (id: string) => takenPersons.has(personOfCode(id));

    // Rewards never stand on the board, and each goes to one mission only;
    // the proposed starters are never a reward (D-044); nor any other form of them (spec 039).
    if (
      (mission.reward.characters ?? []).some(
        (id) => onBoard(id) || forSale(id) || rewarded.has(id) || isReserved(id) || personTaken(id),
      )
    ) {
      return null;
    }
    switch (mission.type) {
      case 'fight': {
        if (mission.format && !formatFits(mission.format, place)) {
          return null;
        }
        mission.format ??= defaultFormat(place);
        mission.condition ??= 'win';
        break;
      }
      case 'quiz': {
        if (!mission.quiz?.question) {
          const free = sources.questions.filter((question) => !usedQuestions.has(question.question));
          const question = free[Math.floor(random() * free.length)];
          if (!question) {
            return null;
          }
          mission.quiz = { question: question.question, answers: [...question.answers], correct: question.correct };
        }
        break;
      }
      case 'goTo':
      case 'defeat': {
        const farther = (id: string) =>
          mission.type === 'goTo' || (places.get(id)?.distance ?? 0) > place.distance;
        if (mission.targetId) {
          const target = mission.targetId;
          if (isReserved(target)) {
            return null;
          }
          if (!onBoard(target)) {
            // Put on the board only if no other form of its person is in the game (spec 039).
            if (forSale(target) || rewarded.has(target) || !find(target) || personTaken(target)) {
              return null;
            }
            // Put the target in a chosen cell still to be done, farther away for
            // "Batti" (spec 027, 2.4), never where a mission already needs
            // someone, nor in front of or behind a locked path, which keep the
            // strong characters (spec 034).
            const room = characterCells.filter(
              (id) =>
                cellTargets.includes(id) &&
                !processed.has(id) &&
                !storyCells.includes(id) &&
                !chainCells.has(id) &&
                !pinned.has(id) &&
                !openers.has(id) &&
                !places.get(id)?.locked &&
                farther(id),
            );
            const cell = closestByTier(room, target);
            if (!cell) {
              return null;
            }
            replace = { cellId: cell, characterId: target };
          }
        } else {
          const choices = characterCells.filter((id) => farther(id) && notGiver(result[id]?.characterId));
          const cell = choices[Math.floor(random() * choices.length)];
          if (!cell) {
            return null;
          }
          mission.targetId = result[cell]?.characterId;
        }
        break;
      }
      case 'bring': {
        if (mission.targetId) {
          if (isReserved(mission.targetId) || (!onBoard(mission.targetId) && !forSale(mission.targetId))) {
            return null;
          }
        } else {
          const sold = Object.values(result)
            .flatMap((cell) => cell.forSale ?? [])
            .filter(notGiver);
          const choices =
            sold.length > 0
              ? sold
              : characterCells.map((id) => result[id]?.characterId ?? '').filter(notGiver);
          const target = choices[Math.floor(random() * choices.length)];
          if (!target) {
            return null;
          }
          mission.targetId = target;
        }
        break;
      }
      case 'wait':
      case 'skipTurns':
      case 'other':
        break;
    }
    return { mission, lines: entry.lines, ...(replace ? { replace } : {}) };
  }

  /** Of the given cells, the one whose character is nearest in strength to the target. */
  function closestByTier(cells: string[], targetId: string): string | undefined {
    const wanted = tierRank(find(targetId)?.tier) ?? 0;
    return [...cells].sort(
      (a, b) =>
        Math.abs((tierRank(find(result[a]?.characterId)?.tier) ?? 0) - wanted) -
        Math.abs((tierRank(find(result[b]?.characterId)?.tier) ?? 0) - wanted),
    )[0];
  }
}

/** The character who gives a mission of their own; empty for group missions. */
function giverId(entry: CatalogMission): string {
  return 'characterId' in entry.giver ? entry.giver.characterId : '';
}

/** A catalog entry made concrete for one cell. */
interface Planned {
  mission: Mission;
  lines: string[];
  /** A character moved into another cell so that the mission can be done. */
  replace?: { cellId: string; characterId: string };
}

/**
 * Format by distance (spec 027, 2.4): 1v1 in the nearest third of each side,
 * 2v2 farther, 3v3 only in the farthest cell of a side.
 */
function defaultFormat(place: CellPlace): ChallengeFormat {
  if (place.firstThird) {
    return '1v1';
  }
  return place.farthest ? '3v3' : '2v2';
}

function formatFits(format: ChallengeFormat, place: CellPlace): boolean {
  if (format === '1v1') {
    return true;
  }
  if (format === '2v2') {
    return !place.firstThird;
  }
  return place.farthest;
}

/**
 * Each cell's side (its nearest start along open paths; behind a locked
 * path, along any path) and its place along the side.
 */
function cellPlaces(map: GameMap, cellIds: string[]): Map<string, CellPlace> {
  const starts = map.nodes.filter((node) => node.type === 'start').map((node) => node.id);
  const open = starts.map((id) => openDistances(map, id));
  const any = starts.map((id) => anyDistances(map, id));
  const bySide = new Map<number, { id: string; distance: number; locked: boolean }[]>();
  for (const id of cellIds) {
    const openSteps = open.map((distances) => distances.get(id) ?? Infinity);
    const nearestOpen = Math.min(Infinity, ...openSteps);
    const locked = nearestOpen === Infinity;
    const steps = locked ? any.map((distances) => distances.get(id) ?? Infinity) : openSteps;
    const nearest = Math.min(Infinity, ...steps);
    const owners = steps.flatMap((step, index) => (step === nearest ? [index] : []));
    const side = owners.length === 1 ? (owners[0] as number) : -1;
    // Cells behind a locked path come after every open one.
    const distance = locked ? 10_000 + (Number.isFinite(nearest) ? nearest : 10_000) : nearest;
    const list = bySide.get(side) ?? [];
    list.push({ id, distance, locked });
    bySide.set(side, list);
  }
  const places = new Map<string, CellPlace>();
  for (const [side, list] of bySide) {
    list.sort((a, b) => a.distance - b.distance);
    const third = Math.ceil(list.length / 3);
    const inSide = side !== -1;
    list.forEach((entry, index) => {
      places.set(entry.id, {
        side,
        distance: entry.distance,
        firstThird: inSide && index < third && !entry.locked,
        farthest: inSide && index === list.length - 1 && list.length > 1,
        locked: entry.locked,
      });
    });
  }
  return places;
}

/** Steps from one start along every path, locked ones too. */
function anyDistances(map: GameMap, startId: string): Map<string, number> {
  const distances = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  for (const current of queue) {
    const next = (distances.get(current) ?? 0) + 1;
    for (const edge of map.edges) {
      const other = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (other !== null && !distances.has(other)) {
        distances.set(other, next);
        queue.push(other);
      }
    }
  }
  return distances;
}

/** Open cells for the story characters, alternating the sides, the cells of neither side last (spec 027, 2.4). */
function pickStoryCells(
  places: Map<string, CellPlace>,
  taken: Set<string>,
  count: number,
  random: Random,
): string[] {
  const bySide = new Map<number, string[]>();
  for (const [id, place] of places) {
    if (!place.locked && !taken.has(id)) {
      bySide.set(place.side, [...(bySide.get(place.side) ?? []), id]);
    }
  }
  const sides = [...bySide.keys()]
    .sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b))
    .map((side) => shuffle(bySide.get(side) ?? [], random));
  const chosen: string[] = [];
  for (let index = 0; chosen.length < count && sides.some((side) => side.length > 0); index++) {
    const side = sides[index % sides.length];
    const cell = side?.shift();
    if (cell) {
      chosen.push(cell);
    }
  }
  return chosen;
}

/** The entries in a random order where heavier ones tend to come first. */
function weightedOrder(entries: CatalogMission[], random: Random): CatalogMission[] {
  const left = entries.filter((entry) => entry.weight > 0);
  const ordered: CatalogMission[] = [];
  while (left.length > 0) {
    const total = left.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    const index = left.findIndex((entry) => (roll -= entry.weight) < 0);
    ordered.push(...left.splice(index === -1 ? left.length - 1 : index, 1));
  }
  return ordered;
}

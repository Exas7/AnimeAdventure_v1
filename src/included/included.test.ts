import { describe, expect, it } from 'vitest';
import { checkMap } from '../editor/mapEdit';
import { serializeMap } from '../editor/mapFile';
import type { GameMap } from '../engine';
import { testItems, testMap } from '../engine';
import { tierRank } from '../episode/fill';
import { randomEpisode } from '../episode/stepRandomize';
import { EMPTY_TEXT_LIBRARY } from '../episode/textLibrary';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { boardSize, cellRadius, cellsOffBoard } from '../ui/boardModel';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';
import { includedMapId, isIncludedMapId, listIncludedMaps, readIncludedMaps } from './includedMaps';

describe('the lists that come with the app (spec 030, criterion 5)', () => {
  it('read without errors: 166 characters, 128 missions, 60 questions', () => {
    const catalog = includedCatalog();
    expect(catalog).toHaveLength(166);
    expect(catalog.filter((character) => character.possibleStarter)).toHaveLength(24);
    // Spec 043: the catalog rewritten (it was 45 after specs 031 and 034), 20 questions for each level (it was 45).
    expect(includedMissions(catalog)).toHaveLength(128);
    expect(includedQuestions()).toHaveLength(60);
  });

  it('the challenge Cell + Cell Jr., given by Cell (forma perfetta) (spec 034, criterion 7)', () => {
    const catalog = includedCatalog();
    const id = (name: string) => catalog.find((character) => character.name === name)?.id;
    const cell = includedMissions(catalog).find(
      (entry) => 'characterId' in entry.giver && entry.giver.characterId === id('Cell (forma perfetta)'),
    );
    expect(cell?.mission).toMatchObject({
      type: 'fight',
      format: '2v2',
      condition: 'win',
      opponents: [id('Cell (forma perfetta)'), id('Cell Jr.')],
    });
  });

  it('every character has its person: one character with its transformations (spec 031, criterion 5; D-064)', () => {
    const catalog = includedCatalog();
    expect(catalog.every((character) => character.person)).toBe(true);
    const person = (name: string) => catalog.find((character) => character.name === name)?.person;
    expect(person('Son Gohan SSJ2')).toBe(person('Son Gohan'));
    expect(person('Cooler (forma finale)')).toBe(person('Cooler'));
    // Not transformations in BT3: other persons (D-064, changes D-048).
    expect(person('Great Saiyaman')).not.toBe(person('Son Gohan'));
    expect(person('Metal Cooler')).not.toBe(person('Cooler'));
    expect(person('Son Goku (fine)')).not.toBe(person('Son Goku (metà)'));
    expect(person('Son Gohan (nonno)')).not.toBe(person('Son Gohan'));
    expect(person('Trunks (bambino)')).not.toBe(person('Trunks'));
  });

  it('a transformation stays within one person (spec 039, 2.1)', () => {
    const catalog = includedCatalog();
    const byId = new Map(catalog.map((character) => [character.id, character]));
    const transforming = catalog.filter((character) => character.fight?.transformsInto);
    expect(transforming.length).toBeGreaterThan(30);
    for (const character of transforming) {
      expect(byId.get(character.fight?.transformsInto as string)?.person).toBe(character.person);
    }
  });

  it('fights on Pianeta Nameck: at most 70% of the Character cells on average (spec 031 and 034)', async () => {
    const catalog = includedCatalog();
    const map = (await listIncludedMaps()).maps.find((entry) => entry.id === 'inclusa:Pianeta_Nameck')?.map;
    if (!map) {
      throw new Error('Pianeta Nameck is missing');
    }
    const random = seeded(31);
    const runs = 50;
    let fights = 0;
    for (let run = 0; run < runs; run++) {
      const { content } = randomEpisode(map, {
        catalog,
        specialKeepers: [],
        powers: DEFAULT_READY_POWERS,
        texts: EMPTY_TEXT_LIBRARY,
        missions: { catalog: includedMissions(catalog), questions: includedQuestions(), items: testItems },
        perShop: 3,
        random,
      });
      fights += Object.values(content).filter((cell) => cell.mission?.type === 'fight').length;
    }
    // The conductor (spec 034): 60-65% is right, 50-70% is fine.
    const characterCells = map.nodes.filter((node) => node.type === 'character').length;
    expect(fights / runs / characterCells).toBeLessThanOrEqual(0.7);
  });

  it('on Pianeta Nameck: who opens a grey road fights or gives "Batti", stronger than the others; no target off the board (spec 034, criterion 3)', async () => {
    const catalog = includedCatalog();
    const map = (await listIncludedMaps()).maps.find((entry) => entry.id === 'inclusa:Pianeta_Nameck')?.map;
    if (!map) {
      throw new Error('Pianeta Nameck is missing');
    }
    const locked = map.edges.filter((edge) => edge.locked);
    const openers = new Set(locked.map((edge) => edge.unlockNodeId));
    const behind = new Set(locked.map((edge) => (edge.from === edge.unlockNodeId ? edge.to : edge.from)));
    const rank = (id: string | undefined) => tierRank(catalog.find((character) => character.id === id)?.tier);
    const ranks = { openers: [] as number[], others: [] as number[] };
    const random = seeded(34);
    for (let run = 0; run < 100; run++) {
      const { content } = randomEpisode(map, {
        catalog,
        specialKeepers: [],
        powers: DEFAULT_READY_POWERS,
        texts: EMPTY_TEXT_LIBRARY,
        missions: { catalog: includedMissions(catalog), questions: includedQuestions(), items: testItems },
        perShop: 3,
        random,
      });
      const board = new Set(Object.values(content).flatMap((cell) => (cell.characterId ? [cell.characterId] : [])));
      const sold = new Set(Object.values(content).flatMap((cell) => cell.forSale ?? []));
      for (const node of map.nodes.filter((entry) => entry.type === 'character')) {
        const cell = content[node.id];
        const mission = cell?.mission;
        if (mission?.type === 'goTo' || mission?.type === 'defeat') {
          expect(board.has(mission.targetId ?? '')).toBe(true);
        }
        if (mission?.type === 'bring') {
          expect(board.has(mission.targetId ?? '') || sold.has(mission.targetId ?? '')).toBe(true);
        }
        const value = rank(cell?.characterId);
        if (openers.has(node.id)) {
          expect(['fight', 'defeat']).toContain(mission?.type);
          if (value !== null) ranks.openers.push(value);
        } else if (!behind.has(node.id) && value !== null) {
          ranks.others.push(value);
        }
      }
    }
    const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
    expect(average(ranks.openers)).toBeGreaterThan(average(ranks.others) + 2);
  });
});

describe('«Batti» without chains (spec 070, criterion 1)', () => {
  it('on every base map, who is to be beaten holds a fight', async () => {
    const catalog = includedCatalog();
    const random = seeded(70);
    let defeats = 0;
    for (const { map } of (await listIncludedMaps()).maps) {
      for (let run = 0; run < 40; run++) {
        const { content } = randomEpisode(map, {
          catalog,
          specialKeepers: [],
          powers: DEFAULT_READY_POWERS,
          texts: EMPTY_TEXT_LIBRARY,
          missions: { catalog: includedMissions(catalog), questions: includedQuestions(), items: testItems },
          perShop: 3,
          random,
        });
        for (const cell of Object.values(content)) {
          if (cell.mission?.type !== 'defeat') {
            continue;
          }
          defeats += 1;
          const target = Object.values(content).find((other) => other.characterId === cell.mission?.targetId);
          expect(target?.mission?.type).toBe('fight');
        }
      }
    }
    expect(defeats).toBeGreaterThan(50);
  });
});

describe('the maps that come with the app (spec 030, criterion 6)', () => {
  it('a file is read as a map, with the name written inside; a broken one is reported', async () => {
    const result = await readIncludedMaps({
      '/assets/maps/incluse/Prova.json': () => Promise.resolve(serializeMap(testMap)),
      '/assets/maps/incluse/Rotta.json': () => Promise.resolve('{"format":"altro"}'),
    });
    expect(result.maps).toEqual([{ id: 'inclusa:Prova', map: testMap }]);
    expect(result.errors).toEqual(['Rotta.json: Il file non è una mappa.']);
  });

  it('their codes never look like those of the library', () => {
    expect(includedMapId('../../assets/maps/incluse/Pianeta_Nameck.json')).toBe('inclusa:Pianeta_Nameck');
    expect(isIncludedMapId('inclusa:Pianeta_Nameck')).toBe(true);
    expect(isIncludedMapId(crypto.randomUUID())).toBe(false);
  });

  it('the three default maps, each with its background (spec 036, criterion 1)', async () => {
    const { maps, errors } = await listIncludedMaps();
    expect(errors).toEqual([]);
    expect(maps.map((entry) => [entry.id, entry.map.name]).sort()).toEqual([
      ['inclusa:Inferi', 'Inferi'],
      ['inclusa:Pianeta_Nameck', 'Pianeta Nameck'],
      ['inclusa:Pianeta_dei_Kaioshin', 'Pianeta dei Kaioshin'],
    ]);
    for (const { map } of maps) {
      expect(map.background?.image.startsWith('data:image/jpeg;base64,')).toBe(true);
    }
  });

  it('each follows the map rules, with the size of Nameck (spec 036, criterion 2)', async () => {
    for (const { map } of (await listIncludedMaps()).maps) {
      const count = (type: string) => map.nodes.filter((node) => node.type === type).length;
      expect(checkMap(map), map.name).toEqual([]);
      expect(count('start'), map.name).toBe(2);
      expect(count('shop'), map.name).toBe(2);
      expect(count('special'), map.name).toBe(0);
      expect(map.nodes.length, map.name).toBeGreaterThanOrEqual(90);
      expect(map.nodes.length, map.name).toBeLessThanOrEqual(115);
      expect(count('character'), map.name).toBeGreaterThanOrEqual(35);
      expect(count('character'), map.name).toBeLessThanOrEqual(45);
      const roads = map.edges.filter((edge) => edge.locked && edge.unlockNodeId).length;
      expect(roads, map.name).toBeGreaterThanOrEqual(6);
      expect(roads, map.name).toBeLessThanOrEqual(8);
    }
  });

  it('cells and paths keep apart and inside the background (spec 044, criterion 3; spec 046, criterion 3)', async () => {
    for (const { map } of (await listIncludedMaps()).maps) {
      const size = boardSize(map);
      const at = new Map(map.nodes.map((node) => [node.id, { x: node.x * size.width, y: node.y * size.height }]));
      const place = (id: string) => at.get(id) as { x: number; y: number };
      const radius = (id: string) => cellRadius(map.nodes.find((node) => node.id === id)?.type ?? 'empty');
      // Measured here on straight lines: the default maps have no curved paths.
      expect(map.edges.filter((edge) => edge.curve.length > 0), map.name).toEqual([]);
      // Spec 046: at least 10 units between two cells (spec 044 allowed the overlaps of before, 8 at most).
      const touching: string[] = [];
      for (const [index, a] of map.nodes.entries()) {
        for (const b of map.nodes.slice(index + 1)) {
          const gap =
            Math.hypot(place(a.id).x - place(b.id).x, place(a.id).y - place(b.id).y) - radius(a.id) - radius(b.id);
          if (gap < 10) {
            touching.push(`${a.id}-${b.id}`);
          }
        }
      }
      expect(touching, map.name).toEqual([]);
      // Spec 046: a path at least 10 units from the cells it does not join (spec 044 allowed two over a cell).
      const over: string[] = [];
      for (const edge of map.edges) {
        for (const node of map.nodes.filter((entry) => entry.id !== edge.from && entry.id !== edge.to)) {
          if (segmentDistance(place(node.id), place(edge.from), place(edge.to)) < radius(node.id) + 10) {
            over.push(`${edge.from}-${edge.to} over ${node.id}`);
          }
        }
      }
      expect(over, map.name).toEqual([]);
      const crossing: string[] = [];
      for (const [index, a] of map.edges.entries()) {
        for (const b of map.edges.slice(index + 1)) {
          const shared = [a.from, a.to].some((id) => id === b.from || id === b.to);
          if (!shared && segmentsCross(place(a.from), place(a.to), place(b.from), place(b.to))) {
            crossing.push(`${a.from}-${a.to} x ${b.from}-${b.to}`);
          }
        }
      }
      expect(crossing, map.name).toEqual([]);
      expect(cellsOffBoard(map), map.name).toEqual([]);
    }
  });

  it('the two starts are near two opposite corners (spec 036, criterion 3)', async () => {
    for (const { map } of (await listIncludedMaps()).maps) {
      const [a, b] = map.nodes.filter((node) => node.type === 'start');
      if (!a || !b) {
        throw new Error(`${map.name}: two starts expected`);
      }
      // Each start in a corner quarter of the map, the two in opposite quarters.
      const quarter = (node: { x: number; y: number }): [number, number] => [
        node.x < 0.25 ? -1 : node.x > 0.75 ? 1 : 0,
        node.y < 0.25 ? -1 : node.y > 0.75 ? 1 : 0,
      ];
      const [ax, ay] = quarter(a);
      const [bx, by] = quarter(b);
      expect([ax, ay, bx, by].every((value) => value !== 0), map.name).toBe(true);
      expect(ax === -bx && ay === -by, map.name).toBe(true);
    }
  });

  it('no paths for their own sake: no detour, every short loop visits a cell (spec 056, criterion 2)', async () => {
    for (const { map } of (await listIncludedMaps()).maps) {
      const near = neighbours(map);
      const passage = (id: string) => map.nodes.find((node) => node.id === id)?.type === 'empty';
      // A passage with two paths that joins two cells already joined to each other.
      const detours = map.nodes
        .filter((node) => node.type === 'empty' && near(node.id).length === 2)
        .filter((node) => {
          const [a, b] = near(node.id) as [string, string];
          return near(a).includes(b);
        })
        .map((node) => node.id);
      expect(detours, map.name).toEqual([]);
      // Loops of 3 or 4 cells made of passages only: a-b-c and a-b-d-c.
      const emptyLoops: string[] = [];
      for (const a of map.nodes.map((node) => node.id)) {
        for (const [index, b] of near(a).entries()) {
          for (const c of near(a).slice(index + 1)) {
            const loops = near(b).includes(c) ? [[a, b, c]] : [];
            loops.push(...near(b).filter((d) => d !== a && near(c).includes(d)).map((d) => [a, b, d, c]));
            emptyLoops.push(...loops.filter((loop) => loop.every(passage)).map((loop) => loop.join('-')));
          }
        }
      }
      expect(emptyLoops, map.name).toEqual([]);
    }
  });

  it('the characters spread over the map, alike on both sides (spec 056, criteria 3 and 4)', async () => {
    for (const { map } of (await listIncludedMaps()).maps) {
      const size = boardSize(map);
      const place = (node: { x: number; y: number }) => ({ x: node.x * size.width, y: node.y * size.height });
      const characters = map.nodes.filter((node) => node.type === 'character');
      const far = map.nodes
        .filter((node) => Math.min(...characters.map((other) => distance(place(node), place(other)))) > 200)
        .map((node) => node.id);
      expect(far, map.name).toEqual([]);
      const [a, b] = map.nodes.filter((node) => node.type === 'start');
      if (!a || !b) {
        throw new Error(`${map.name}: two starts expected`);
      }
      const nearA = characters.filter((node) => distance(place(node), place(a)) < distance(place(node), place(b)));
      expect(Math.abs(2 * nearA.length - characters.length), map.name).toBeLessThanOrEqual(3);
      const fromA = stepsFrom(map, a.id);
      const fromB = stepsFrom(map, b.id);
      const closerA = characters.filter((node) => (fromA.get(node.id) ?? 0) < (fromB.get(node.id) ?? 0)).length;
      const closerB = characters.filter((node) => (fromB.get(node.id) ?? 0) < (fromA.get(node.id) ?? 0)).length;
      expect(Math.abs(closerA - closerB), map.name).toBeLessThanOrEqual(2);
    }
  });
});

/** The cells joined to each one by a path, grey roads included. */
function neighbours(map: GameMap): (id: string) => string[] {
  const near = new Map<string, string[]>(map.nodes.map((node) => [node.id, []]));
  for (const edge of map.edges) {
    near.get(edge.from)?.push(edge.to);
    near.get(edge.to)?.push(edge.from);
  }
  return (id) => near.get(id) ?? [];
}

/** How many paths away each cell is from the given one. */
function stepsFrom(map: GameMap, start: string): Map<string, number> {
  const near = neighbours(map);
  const steps = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of near(current)) {
      if (!steps.has(next)) {
        steps.set(next, (steps.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return steps;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Repeatable "random" numbers (mulberry32): the same seed, the same episodes. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from a point to the straight path between two cells. */
function segmentDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length));
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

/** Whether two straight paths cross each other, away from their ends. */
function segmentsCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const side = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

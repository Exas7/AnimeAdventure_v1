import { describe, expect, it } from 'vitest';
import type { Character, GameMap, NodeType } from '../engine';
import { canBeDrawn, placementOrder, randomize, tierRank, type Content } from './fill';
import { EMPTY_TEXT_LIBRARY } from './textLibrary';

/**
 * Two starts, s1 and s2. Side 1: a1 (1 step), a2 (2 steps); side 2: b1, b2
 * the same; m is 3 steps from both; x is behind a locked path from m; the
 * shops sh1 and sh2 hang from a1 and b1; p is a passage cell.
 */
function twoSidedMap(): GameMap {
  const node = (id: string, type: NodeType) => ({ id, x: 0.5, y: 0.5, type });
  const edge = (from: string, to: string, locked = false) => ({
    id: `${from}-${to}`,
    from,
    to,
    curve: [],
    locked,
  });
  return {
    name: 'Due lati',
    nodes: [
      node('s1', 'start'),
      node('a1', 'character'),
      node('a2', 'character'),
      node('m', 'character'),
      node('b2', 'character'),
      node('b1', 'character'),
      node('s2', 'start'),
      node('x', 'character'),
      node('sh1', 'shop'),
      node('sh2', 'shop'),
      node('p', 'empty'),
    ],
    edges: [
      edge('s1', 'a1'),
      edge('a1', 'a2'),
      edge('a2', 'm'),
      edge('m', 'b2'),
      edge('b2', 'b1'),
      edge('b1', 's2'),
      edge('m', 'x', true),
      edge('a1', 'sh1'),
      edge('b1', 'sh2'),
      edge('m', 'p'),
    ],
  };
}

const character = (id: string, tier?: string, extra: Partial<Character> = {}): Character => ({
  id,
  name: id.toUpperCase(),
  ...(tier ? { tier } : {}),
  ...extra,
});

/** Six recruitable characters, and four that "Randomizza" must never draw. */
const catalog: Character[] = [
  character('cminus', 'C-'),
  character('c', 'C'),
  character('b', 'B'),
  character('bplus', 'B+'),
  character('a', 'A'),
  character('s', 'S'),
  character('weakE', 'E'),
  character('weakD', 'D+'),
  character('story'),
  character('keeper', 'B', { shopkeeper: true }),
];

const CELLS = ['a1', 'a2', 'm', 'b2', 'b1', 'x'];

/** A repeatable source of "random" numbers. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] as number;
}

const RANDOMS = [sequence(0.1), sequence(0.9), sequence(0.3, 0.7, 0.5), sequence(0.55, 0.05)];

function run(content: Content, nodeIds: string[], random: () => number, list = catalog, specials: Character[] = []) {
  return randomize(twoSidedMap(), content, list, specials, EMPTY_TEXT_LIBRARY, nodeIds, 2, random);
}

const rankOf = (id: string | undefined) =>
  tierRank(catalog.find((entry) => entry.id === id)?.tier) as number;

describe('Randomizza, character cells (spec 022, criteria 1-3)', () => {
  it('draws only recruitable characters from C- up, never shopkeepers (D-034)', () => {
    expect(catalog.filter(canBeDrawn).map((entry) => entry.id)).toEqual([
      'cminus',
      'c',
      'b',
      'bplus',
      'a',
      's',
    ]);
  });

  it('C1: no E or D, nobody without a tier, no shopkeeper, no duplicates, none already used', () => {
    for (const random of RANDOMS) {
      const used = { sh1: { characterId: 'keeper', forSale: ['bplus'] } };
      const { content } = run(used, CELLS, random);
      const placed = CELLS.map((id) => content[id]?.characterId).filter(Boolean);
      expect(placed).toHaveLength(5);
      expect(new Set(placed).size).toBe(placed.length);
      expect(placed).not.toContain('bplus');
      for (const id of placed) {
        expect(['weakE', 'weakD', 'story', 'keeper']).not.toContain(id);
      }
    }
  });

  it('C2: the cell behind a locked path gets the strongest drawn', () => {
    for (const random of RANDOMS) {
      expect(run({}, CELLS, random).content.x?.characterId).toBe('s');
    }
  });

  it('C3: paired cells of the two sides get characters close in strength, the weakest nearest', () => {
    expect(placementOrder(twoSidedMap(), CELLS)).toEqual({
      open: [['a1', 'b1'], ['a2', 'b2'], ['m']],
      locked: ['x'],
    });
    for (const random of RANDOMS) {
      const { content } = run({}, CELLS, random);
      const id = (cell: string) => content[cell]?.characterId;
      expect(new Set([id('a1'), id('b1')])).toEqual(new Set(['cminus', 'c']));
      expect(new Set([id('a2'), id('b2')])).toEqual(new Set(['b', 'bplus']));
      expect(id('m')).toBe('a');
      expect(Math.abs(rankOf(id('a1')) - rankOf(id('b1')))).toBeLessThanOrEqual(1);
    }
  });

  it('with too few characters it fills what it can, and the strongest still goes behind the lock', () => {
    const few = [character('c', 'C'), character('s', 'S')];
    const result = run({}, CELLS, sequence(0.5), few);
    expect([result.cellsFilled, result.cellsLeftEmpty]).toEqual([2, 4]);
    expect(result.content.x?.characterId).toBe('s');
  });

  it('a refilled cell keeps its lines and format; one without lines gets one from the library (D-031)', () => {
    const texts = { lines: ['Battimi senza trasformarti!'] };
    const start = { a1: { characterId: 'story', lines: ['Mia'], format: '2v2' as const } };
    const { content } = randomize(twoSidedMap(), start, catalog, [], texts, ['a1', 'a2'], 2, sequence(0.3));
    expect(content.a1?.lines).toEqual(['Mia']);
    expect(content.a1?.format).toBe('2v2');
    expect(content.a1?.characterId).not.toBe('story');
    expect(content.a2?.lines).toEqual(['Battimi senza trasformarti!']);
  });

  it('only character cells and shops change', () => {
    const { content } = run({}, ['s1', 'p', 'a1'], sequence(0.5));
    expect(Object.keys(content)).toEqual(['a1']);
  });
});

describe('Randomizza, shops (spec 022, criterion 4)', () => {
  const shopCatalog: Character[] = [
    character('p1', 'B', { price: 100 }),
    character('p2', 'A', { price: 200 }),
    character('p3', 'S', { price: 300 }),
    character('cheapE', 'E', { price: 50 }),
    character('storyPriced', undefined, { price: 80 }),
    character('kami', undefined, { shopkeeper: true }),
    character('roshi', 'D+', { shopkeeper: true, price: 90 }),
  ];
  const special = character('special-1', undefined, { shopkeeper: true, imageData: 'data:image/png;base64,AA' });

  it('each shop gets its own shopkeeper, from the list or special, and priced characters from C- up', () => {
    for (const random of RANDOMS) {
      const result = run({}, ['sh1', 'sh2'], random, shopCatalog, [special]);
      const keepers = [result.content.sh1?.characterId, result.content.sh2?.characterId];
      expect(new Set(keepers).size).toBe(2);
      for (const keeper of keepers) {
        expect(['kami', 'roshi', 'special-1']).toContain(keeper);
      }
      const sold = [...(result.content.sh1?.forSale ?? []), ...(result.content.sh2?.forSale ?? [])];
      expect(new Set(sold)).toEqual(new Set(['p1', 'p2', 'p3']));
      expect([result.forSaleFilled, result.forSaleLeftEmpty, result.keepersKept]).toEqual([3, 1, 0]);
    }
  });

  it('without a free shopkeeper a shop keeps its own', () => {
    const start = { sh1: { characterId: 'oldOne' }, sh2: { characterId: 'oldTwo' } };
    const result = run(start, ['sh1', 'sh2'], sequence(0.4), [character('kami', undefined, { shopkeeper: true })]);
    const keepers = [result.content.sh1?.characterId, result.content.sh2?.characterId];
    expect(keepers).toContain('kami');
    expect(keepers.filter((keeper) => keeper === 'oldOne' || keeper === 'oldTwo')).toHaveLength(1);
    expect(result.keepersKept).toBe(1);
  });

  it('characters for sale are never already in a cell', () => {
    const start = { a1: { characterId: 'p1' } };
    const sold = run(start, ['sh1'], sequence(0.2), shopCatalog).content.sh1?.forSale ?? [];
    expect(sold).not.toContain('p1');
  });
});

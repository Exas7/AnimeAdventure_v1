import { describe, expect, it } from 'vitest';
import { testItems, testMap, type Character, type GameMap, type NodeType } from '../engine';
import type { CatalogMission } from '../missions/catalog';
import { proposedCharacters } from '../starters/proposals';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import type { Content } from './fill';
import {
  charactersInContent,
  nextEpisodeName,
  pickPlayableMap,
  randomEpisode,
  randomizeCellsStep,
  randomizeShopsStep,
  randomizeStartersStep,
  shopRows,
  type RandomSources,
} from './stepRandomize';
import { EMPTY_TEXT_LIBRARY } from './textLibrary';

/** A repeatable source of "random" numbers. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] as number;
}

function lineMap(): GameMap {
  const node = (id: string, type: NodeType) => ({ id, x: 0.5, y: 0.5, type });
  const edge = (from: string, to: string) => ({ id: `${from}-${to}`, from, to, curve: [], locked: false });
  return {
    name: 'Linea',
    nodes: [
      node('s1', 'start'),
      node('a1', 'character'),
      node('a2', 'character'),
      node('a3', 'character'),
      node('b3', 'character'),
      node('b2', 'character'),
      node('b1', 'character'),
      node('s2', 'start'),
      node('sh1', 'shop'),
      node('sh2', 'shop'),
    ],
    edges: [
      edge('s1', 'a1'),
      edge('a1', 'a2'),
      edge('a2', 'a3'),
      edge('a3', 'b3'),
      edge('b3', 'b2'),
      edge('b2', 'b1'),
      edge('b1', 's2'),
      edge('a1', 'sh1'),
      edge('b1', 'sh2'),
    ],
  };
}

const CELLS = ['a1', 'a2', 'a3', 'b3', 'b2', 'b1'];
const SHOPS = ['sh1', 'sh2'];

const character = (id: string, tier: string | undefined, extra: Partial<Character> = {}): Character => ({
  id,
  name: id,
  price: 300,
  ...(tier ? { tier } : {}),
  ...extra,
});

const catalog: Character[] = [
  ...['st-1', 'st-2', 'st-3', 'st-4', 'st-5', 'st-6'].map((id) => character(id, 'C', { possibleStarter: true })),
  ...['c-1', 'c-2', 'c-3', 'c-4', 'b-1', 'b-2', 'b-3', 'b-4', 'a-1', 'a-2', 'a-3', 'a-4'].map((id) =>
    character(id, id.startsWith('c') ? 'C+' : id.startsWith('b') ? 'B' : 'A'),
  ),
  character('roshi', undefined, { shopkeeper: true }),
  character('karin', undefined, { shopkeeper: true }),
];

const missions: CatalogMission[] = [
  {
    id: 'fight',
    giver: { group: 'recruitable' },
    mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } },
    lines: ['Combatti!'],
    weight: 1,
  },
];

function sources(random = sequence(0.3, 0.7, 0.5)): RandomSources {
  return {
    catalog,
    specialKeepers: [],
    powers: DEFAULT_READY_POWERS,
    texts: EMPTY_TEXT_LIBRARY,
    missions: { catalog: missions, questions: [], items: testItems },
    perShop: 2,
    random,
  };
}

/** Everyone placed, in cells and for sale: each one must appear once. */
function placed(content: Content): string[] {
  return Object.values(content).flatMap((cell) => [
    ...(cell.characterId ? [cell.characterId] : []),
    ...(cell.forSale ?? []),
  ]);
}

describe('the name of a new episode (spec 030, criterion 2)', () => {
  it('takes the first free number', () => {
    expect(nextEpisodeName('Pianeta Nameck', [])).toBe('Pianeta Nameck · 1');
    expect(nextEpisodeName('Pianeta Nameck', ['Pianeta Nameck · 1'])).toBe('Pianeta Nameck · 2');
    expect(nextEpisodeName('Pianeta Nameck', ['Pianeta Nameck · 1', 'Pianeta Nameck · 3', 'Altra · 2'])).toBe(
      'Pianeta Nameck · 2',
    );
  });
});

describe('a map at random (spec 030, criterion 2)', () => {
  it('only among maps with Character cells', async () => {
    const maps: Record<string, GameMap> = { prova: testMap, linea: lineMap() };
    const load = (id: string) => Promise.resolve(maps[id] ?? null);
    const options = [{ id: 'prova' }, { id: 'sparita' }, { id: 'linea' }];
    for (const random of [sequence(0.1), sequence(0.9), sequence(0.5, 0.2)]) {
      expect((await pickPlayableMap(options, load, random))?.option.id).toBe('linea');
    }
    expect(await pickPlayableMap([{ id: 'prova' }], load, sequence(0.1))).toBeNull();
  });
});

describe('characters already in an episode', () => {
  it('counts cells, shops, characters for sale and those named by missions', () => {
    const content: Content = {
      a1: { characterId: 'c-1', mission: { type: 'defeat', targetId: 'a-1', reward: { characters: ['a-2'] } } },
      a2: { characterId: 'c-2', mission: { type: 'fight', opponents: ['b-1'], reward: {} } },
      sh1: { characterId: 'roshi', forSale: ['b-2'] },
    };
    expect([...charactersInContent(content)].sort()).toEqual(['a-1', 'a-2', 'b-1', 'b-2', 'c-1', 'c-2', 'roshi']);
  });

  it('random starters never take them (D-044)', () => {
    const content: Content = { a1: { characterId: 'st-1' }, a2: { characterId: 'c-1', mission: { type: 'bring', targetId: 'st-2', reward: {} } } };
    const ids = proposedCharacters(randomizeStartersStep(content, sources()).proposals);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain('st-1');
    expect(ids).not.toContain('st-2');
  });
});

describe('one step at a time (spec 030, 2.2)', () => {
  const starters = randomizeStartersStep(null, sources()).proposals;

  it('"Randomizza i negozi" changes only the shops (criterion 3)', () => {
    const cells: Content = { a1: { characterId: 'c-1', lines: ['Ciao'] }, a2: { characterId: 'c-2' } };
    const { content, summary } = randomizeShopsStep(lineMap(), cells, starters, sources());
    expect(content.a1).toEqual(cells.a1);
    expect(content.a2).toEqual(cells.a2);
    for (const shop of SHOPS) {
      expect(['roshi', 'karin']).toContain(content[shop]?.characterId);
      expect(content[shop]?.forSale).toHaveLength(2);
    }
    const forSale = SHOPS.flatMap((shop) => content[shop]?.forSale ?? []);
    expect(forSale.some((id) => ['c-1', 'c-2', ...proposedCharacters(starters)].includes(id))).toBe(false);
    expect(summary).toEqual(['2 negozi, 4 personaggi in vendita.']);
    expect(shopRows(lineMap(), content, catalog).map((row) => row.forSale.length)).toEqual([2, 2]);
  });

  it('"Randomizza personaggi e missioni" keeps the shops of the step before (criterion 4)', () => {
    const shops = randomizeShopsStep(lineMap(), {}, starters, sources()).content;
    const { content, summary } = randomizeCellsStep(lineMap(), shops, starters, sources(sequence(0.9, 0.2)));
    for (const shop of SHOPS) {
      expect(content[shop]).toEqual(shops[shop]);
    }
    expect(CELLS.every((cell) => content[cell]?.characterId)).toBe(true);
    const all = placed(content);
    expect(new Set(all).size).toBe(all.length);
    expect(all.some((id) => proposedCharacters(starters).includes(id))).toBe(false);
    expect(summary[0]).toBe('6 Caselle personaggio riempite.');
    expect(summary.some((line) => line.includes('negozi'))).toBe(false);
  });

  it('with empty shops, "Randomizza personaggi e missioni" fills them too, as before', () => {
    const { content, summary } = randomizeCellsStep(lineMap(), {}, starters, sources());
    expect(SHOPS.every((shop) => content[shop]?.characterId)).toBe(true);
    expect(summary).toContain('2 negozi, 4 personaggi in vendita.');
  });
});

describe('everything at once ("Puntata casuale", "Randomizza tutto")', () => {
  it('starters, shops and cells, with the starters off the map', () => {
    for (const random of [sequence(0.1), sequence(0.9), sequence(0.42, 0.13, 0.77, 0.61)]) {
      const episode = randomEpisode(lineMap(), sources(random));
      const starters = proposedCharacters(episode.starters);
      expect(starters).toHaveLength(6);
      expect([...charactersInContent(episode.content)].some((id) => starters.includes(id))).toBe(false);
      expect([...CELLS, ...SHOPS].every((id) => episode.content[id]?.characterId)).toBe(true);
      expect(episode.shopSummary).toEqual(['2 negozi, 4 personaggi in vendita.']);
      expect(episode.cellSummary[0]).toBe('6 Caselle personaggio riempite.');
    }
  });

  it('says what could not be filled, for the tendine of "Nuova partita" (spec 033)', () => {
    const full = randomEpisode(lineMap(), sources());
    expect(full.shortages).toEqual({ cellsLeftEmpty: 0, forSaleLeftEmpty: 0, keepersKept: 0 });
    const few = randomEpisode(lineMap(), { ...sources(), catalog: catalog.slice(0, 8) });
    expect(few.shortages.cellsLeftEmpty + few.shortages.forSaleLeftEmpty).toBeGreaterThan(0);
  });
});

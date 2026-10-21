import { describe, expect, it } from 'vitest';
import { cellMission, testItems, type Character, type GameMap, type NodeType } from '../engine';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { randomize, tierRank, type Content } from './fill';
import { randomizeWithMissions, type MissionSources } from './missionFill';
import { EMPTY_TEXT_LIBRARY } from './textLibrary';

/**
 * Two starts. Side 1: a1, a2, a3 (1, 2, 3 steps); side 2: b1, b2, b3 the
 * same; m in the middle; k hangs from m, and behind k a locked path leads to
 * z, a dead end opened by k (D-027). Shops sh1 and sh2 hang from a1 and b1.
 */
function chainMap(): GameMap {
  const node = (id: string, type: NodeType) => ({ id, x: 0.5, y: 0.5, type });
  const edge = (from: string, to: string, locked = false, unlockNodeId?: string) => ({
    id: `${from}-${to}`,
    from,
    to,
    curve: [],
    locked,
    ...(unlockNodeId ? { unlockNodeId } : {}),
  });
  return {
    name: 'Catena',
    nodes: [
      node('s1', 'start'),
      node('a1', 'character'),
      node('a2', 'character'),
      node('a3', 'character'),
      node('m', 'character'),
      node('b3', 'character'),
      node('b2', 'character'),
      node('b1', 'character'),
      node('s2', 'start'),
      node('k', 'character'),
      node('z', 'character'),
      node('sh1', 'shop'),
      node('sh2', 'shop'),
    ],
    edges: [
      edge('s1', 'a1'),
      edge('a1', 'a2'),
      edge('a2', 'a3'),
      edge('a3', 'm'),
      edge('m', 'b3'),
      edge('b3', 'b2'),
      edge('b2', 'b1'),
      edge('b1', 's2'),
      edge('m', 'k'),
      edge('k', 'z', true, 'k'),
      edge('a1', 'sh1'),
      edge('b1', 'sh2'),
    ],
  };
}

const CELLS = ['a1', 'a2', 'a3', 'm', 'b3', 'b2', 'b1', 'k', 'z'];
const ALL = [...CELLS, 'sh1', 'sh2'];

const character = (id: string, tier?: string, extra: Partial<Character> = {}): Character => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  ...(tier ? { tier } : {}),
  ...extra,
});

const characters: Character[] = [
  character('krilin', 'C-', { price: 300 }),
  character('yamcha', 'C', { price: 300 }),
  character('tenshinhan', 'C+'),
  character('piccolo', 'B-'),
  character('vegeta', 'B'),
  character('freeza', 'B+', { villain: true }),
  character('goku', 'A'),
  character('gohan', 'A-'),
  character('tapion', 'S-'),
  character('cooler', 'A', { villain: true }),
  character('metal-cooler', 'S-'),
  // Never drawn by "Randomizza" (tier D): only a mission can bring it in.
  character('hildegarn', 'D'),
  character('goten', 'D+'),
  character('chichi'),
  character('bulma', undefined, { shopkeeper: true }),
  character('karin', undefined, { shopkeeper: true }),
];

const catalog: CatalogMission[] = [
  {
    id: 'chichi',
    giver: { characterId: 'chichi' },
    mission: { type: 'wait', turns: 3, reward: { characters: ['goten'] } },
    lines: ['Aspetta {n} turni e avrai {premio}.'],
    weight: 1,
  },
  {
    id: 'bulma',
    giver: { characterId: 'bulma' },
    mission: { type: 'wait', turns: 3, reward: { coins: 500 } },
    lines: ['Aspetta {n} turni.'],
    weight: 1,
  },
  {
    id: 'cooler',
    giver: { characterId: 'cooler' },
    mission: { type: 'fight', format: '1v1', condition: 'transform', reward: { cellCharacter: true } },
    lines: ['Fammi trasformare!'],
    behindId: 'metal-cooler',
    weight: 1,
  },
  {
    id: 'tapion',
    giver: { characterId: 'tapion' },
    mission: { type: 'defeat', targetId: 'hildegarn', reward: { cellCharacter: true } },
    lines: ['Batti {obiettivo} e verrò con te.'],
    weight: 1,
  },
  {
    id: 'villains',
    giver: { group: 'villains' },
    mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } },
    lines: ['Preparati a perdere.'],
    weight: 1,
  },
  {
    id: 'fight',
    giver: { group: 'recruitable' },
    mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } },
    lines: ['Combatti!'],
    weight: 2,
  },
  {
    id: 'quiz',
    giver: { group: 'recruitable' },
    mission: { type: 'quiz', reward: { cellCharacter: true } },
    lines: ['Rispondi giusto e vengo con te.'],
    weight: 2,
  },
  {
    id: 'bring',
    giver: { group: 'recruitable' },
    mission: { type: 'bring', reward: { cellCharacter: true, coins: 100 } },
    lines: ['Portami {obiettivo} e avrai {premio}.'],
    weight: 1,
  },
];

const questions: QuestionEntry[] = [
  { id: 'q1', question: 'Chi è il padre di Goten?', answers: ['Vegeta', 'Goku', 'Gohan'], correct: 1 },
  { id: 'q2', question: 'Quante sono le sfere del drago?', answers: ['5', '7', '9'], correct: 1 },
];

const sources: MissionSources = { catalog, questions, items: testItems };

/** A repeatable source of "random" numbers. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] as number;
}

const RANDOMS = [
  sequence(0.1),
  sequence(0.9),
  sequence(0.3, 0.7, 0.5),
  sequence(0.55, 0.05, 0.8),
  sequence(0.42, 0.13, 0.77, 0.61),
];

function run(random = RANDOMS[0] as () => number, content: Content = {}) {
  return randomizeWithMissions(
    chainMap(),
    content,
    characters,
    [],
    EMPTY_TEXT_LIBRARY,
    ALL,
    1,
    random,
    sources,
  );
}

/** Bulma keeps a shop: the story character is Chichi (D-047). */
const BULMA_KEEPS_SHOP: Content = { sh1: { characterId: 'bulma' } };

const onBoard = (content: Content) =>
  new Set(Object.values(content).flatMap((cell) => (cell.characterId ? [cell.characterId] : [])));
const forSale = (content: Content) => new Set(Object.values(content).flatMap((cell) => cell.forSale ?? []));

describe('"Randomizza" with missions (spec 027, 2.4)', () => {
  it('with an empty catalog it is the "Randomizza" of spec 022', () => {
    const empty = { ...sources, catalog: [] };
    const plain = randomize(chainMap(), {}, characters, [], EMPTY_TEXT_LIBRARY, ALL, 1, sequence(0.3, 0.6));
    const withNone = randomizeWithMissions(
      chainMap(),
      {},
      characters,
      [],
      EMPTY_TEXT_LIBRARY,
      ALL,
      1,
      sequence(0.3, 0.6),
      empty,
    );
    expect(withNone.content).toEqual(plain.content);
    expect(withNone.notes).toEqual([]);
  });

  it('one story character every 8 cells, never behind a lock (criterion 3)', () => {
    for (const random of RANDOMS) {
      const { content, storyCharacters } = run(random);
      expect(storyCharacters).toBe(1);
      const story = CELLS.filter((id) => ['chichi', 'bulma'].includes(content[id]?.characterId ?? ''));
      expect(story).toHaveLength(1);
      expect(story).not.toContain('z');
    }
  });

  it('a shopkeeper with missions of their own can be the story character, never also keeping a shop (spec 031, criterion 1)', () => {
    const story = new Set<string>();
    for (const random of RANDOMS) {
      const { content } = run(random);
      const placed = Object.values(content).flatMap((cell) => (cell.characterId ? [cell.characterId] : []));
      // Nobody twice: Bulma in a cell keeps no shop, and the other way round.
      expect(new Set(placed).size).toBe(placed.length);
      // Karin keeps shops and has no missions of her own: never in a cell.
      expect(CELLS.map((id) => content[id]?.characterId)).not.toContain('karin');
      for (const id of CELLS) {
        const characterId = content[id]?.characterId ?? '';
        if (['chichi', 'bulma'].includes(characterId)) {
          story.add(characterId);
        }
      }
    }
    expect([...story].sort()).toEqual(['bulma', 'chichi']);
    for (const random of RANDOMS) {
      const { content } = run(random, BULMA_KEEPS_SHOP);
      expect(CELLS.map((id) => content[id]?.characterId)).toContain('chichi');
      expect(CELLS.map((id) => content[id]?.characterId)).not.toContain('bulma');
    }
  });

  it('a mission from the character, or from the group; the same numbers give the same result (criterion 4)', () => {
    const first = run(sequence(0.3, 0.7, 0.5), BULMA_KEEPS_SHOP);
    const again = run(sequence(0.3, 0.7, 0.5), BULMA_KEEPS_SHOP);
    expect(again.content).toEqual(first.content);
    const chichi = CELLS.find((id) => first.content[id]?.characterId === 'chichi') ?? '';
    expect(first.content[chichi]?.mission).toEqual(catalog[0]?.mission);
    for (const id of CELLS) {
      expect(cellMission(first.content[id])).toBeDefined();
    }
  });

  it('formats follow the distance: 1v1 near the starts, 3v3 only at the farthest, one per side (criterion 5)', () => {
    for (const random of RANDOMS) {
      const { content } = run(random);
      const format = (id: string) => content[id]?.mission?.format;
      for (const near of ['a1', 'b1']) {
        if (content[near]?.mission?.type === 'fight') {
          expect(format(near)).toBe('1v1');
        }
      }
      const threes = CELLS.filter((id) => format(id) === '3v3');
      expect(threes.length).toBeLessThanOrEqual(2);
      // The farthest of each side; m, k and z are as far from both starts
      // and belong to neither side (spec 034, 2.5).
      for (const id of threes) {
        expect(['a3', 'b3']).toContain(id);
      }
    }
  });

  it('targets on the board, things to bring on the board or for sale, rewards never on the board (criterion 6)', () => {
    for (const random of RANDOMS) {
      const { content } = run(random);
      const board = onBoard(content);
      const sold = forSale(content);
      for (const id of CELLS) {
        const mission = content[id]?.mission;
        if (mission?.type === 'goTo' || mission?.type === 'defeat') {
          expect(board.has(mission.targetId ?? '')).toBe(true);
        }
        if (mission?.type === 'bring') {
          expect(board.has(mission.targetId ?? '') || sold.has(mission.targetId ?? '')).toBe(true);
        }
        for (const reward of mission?.reward.characters ?? []) {
          expect(board.has(reward) || sold.has(reward)).toBe(false);
        }
      }
    }
  });

  it('a chain: Cooler in the cell that opens the path, Metal Cooler behind (criterion 7)', () => {
    const { content, notes } = run();
    expect(content.k?.characterId).toBe('cooler');
    expect(content.z?.characterId).toBe('metal-cooler');
    expect(content.k?.mission?.condition).toBe('transform');
    expect(notes).toContain('Catena Cooler → Metal-cooler sul percorso #k–#z.');
  });

  it('a target that is not on the board is put in a farther cell, and the director is told', () => {
    // Six recruitable characters for six open cells, Broly stronger than Tapion:
    // Tapion does not end up in the farthest cell, so a farther one is left for Hildegarn.
    const fewer = [
      ...['krilin', 'yamcha', 'tenshinhan', 'vegeta', 'tapion', 'cooler', 'metal-cooler', 'hildegarn', 'goten', 'chichi'].map(
        (id) => characters.find((entry) => entry.id === id) as Character,
      ),
      character('broly', 'SS'),
    ];
    let seen = false;
    for (const random of [...RANDOMS, sequence(0.2), sequence(0.65), sequence(0.85, 0.15)]) {
      const { content, notes, extras } = randomizeWithMissions(
        chainMap(),
        {},
        fewer,
        [],
        EMPTY_TEXT_LIBRARY,
        ALL,
        1,
        random,
        sources,
      );
      const tapion = CELLS.find((id) => content[id]?.characterId === 'tapion');
      if (tapion && content[tapion]?.mission?.type === 'defeat') {
        expect(onBoard(content).has('hildegarn')).toBe(true);
        expect(notes.some((note) => note.startsWith('Hildegarn messo nella casella'))).toBe(true);
        // The same choice for "Sfide extra" (spec 033).
        expect(extras).toContainEqual(
          expect.objectContaining({ kind: 'placed', characterId: 'hildegarn', forId: 'tapion' }),
        );
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('lines with the names filled in (criterion 8)', () => {
    for (const random of RANDOMS) {
      const { content } = run(random, BULMA_KEEPS_SHOP);
      for (const id of CELLS) {
        for (const line of content[id]?.lines ?? []) {
          expect(line).not.toMatch(/[{}]/);
        }
      }
      const chichi = CELLS.find((id) => content[id]?.characterId === 'chichi') ?? '';
      expect(content[chichi]?.lines).toEqual(['Aspetta 3 turni e avrai Goten.']);
    }
  });

  it('questions are never repeated in the same episode (criterion 9)', () => {
    for (const random of RANDOMS) {
      const { content } = run(random);
      const asked = CELLS.flatMap((id) => (content[id]?.mission?.quiz ? [content[id]?.mission?.quiz?.question] : []));
      expect(new Set(asked).size).toBe(asked.length);
      expect(asked.length).toBeLessThanOrEqual(questions.length);
    }
  });

  it('targets chosen by "Randomizza" are never another form of the giver (spec 031, criterion 3)', () => {
    // Two forms of each person, and only group missions with a target to choose.
    const pairs = [
      ['krilin', 'yamcha'],
      ['tenshinhan', 'piccolo'],
      ['vegeta', 'freeza'],
      ['goku', 'gohan'],
      ['tapion', 'cooler'],
      ['metal-cooler', 'goten'],
    ];
    const person = (id: string) => pairs.findIndex((pair) => pair.includes(id));
    const forms = characters.map((character) =>
      person(character.id) >= 0 ? { ...character, person: `Persona ${person(character.id)}` } : character,
    );
    const group = (id: string, type: 'goTo' | 'defeat' | 'bring', giver: 'recruitable' | 'villains') => ({
      id,
      giver: { group: giver },
      mission: { type, reward: { cellCharacter: true } },
      lines: [],
      weight: 1,
    });
    const targets: CatalogMission[] = (['recruitable', 'villains'] as const).flatMap((giver) => [
      group(`${giver}-goTo`, 'goTo', giver),
      group(`${giver}-defeat`, 'defeat', giver),
      group(`${giver}-bring`, 'bring', giver),
    ]);
    let checked = 0;
    for (const random of [...RANDOMS, sequence(0.8, 0.1), sequence(0.65, 0.35, 0.2)]) {
      const { content } = randomizeWithMissions(chainMap(), {}, forms, [], EMPTY_TEXT_LIBRARY, ALL, 1, random, {
        ...sources,
        catalog: targets,
      });
      for (const id of CELLS) {
        const giver = content[id]?.characterId ?? '';
        const target = content[id]?.mission?.targetId;
        if (target && person(giver) >= 0) {
          expect(person(target)).not.toBe(person(giver));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('the starters proposed in the episode go nowhere: cells, shops, targets, rewards, chains (D-044)', () => {
    const reserved = ['tapion', 'hildegarn', 'goten', 'cooler', 'krilin'];
    for (const random of RANDOMS) {
      const { content } = randomizeWithMissions(
        chainMap(),
        {},
        characters,
        [],
        EMPTY_TEXT_LIBRARY,
        ALL,
        1,
        random,
        sources,
        reserved,
      );
      const everywhere = [
        ...onBoard(content),
        ...forSale(content),
        ...CELLS.flatMap((id) => {
          const mission = content[id]?.mission;
          return [...(mission?.targetId ? [mission.targetId] : []), ...(mission?.reward.characters ?? [])];
        }),
      ];
      for (const id of reserved) {
        expect(everywhere).not.toContain(id);
      }
    }
  });

  it('"Sfide extra": the story character, the chain and the placed characters, with their cells (spec 033)', () => {
    for (const random of RANDOMS) {
      const { content, extras, notes } = run(random);
      const story = extras.filter((extra) => extra.kind === 'story');
      expect(story).toHaveLength(1);
      expect(extras).toContainEqual({
        kind: 'chain',
        giverId: 'cooler',
        cellId: 'k',
        behindId: 'metal-cooler',
        behindCellId: 'z',
      });
      const placed = extras.filter((extra) => extra.kind === 'placed');
      expect(placed).toHaveLength(notes.filter((note) => note.includes(' messo nella casella ')).length);
      for (const extra of [...story, ...placed]) {
        expect(content[extra.cellId]?.characterId).toBe(extra.characterId);
      }
    }
  });
});

describe('"Randomizza" after the review of spec 034', () => {
  const rank = (content: Content, cell: string) =>
    tierRank(characters.find((entry) => entry.id === content[cell]?.characterId)?.tier);
  const MORE_RANDOMS = [...RANDOMS, sequence(0.2), sequence(0.65), sequence(0.85, 0.15), sequence(0.33, 0.9, 0.12)];

  it('who opens a locked path gets a strong character and a fight or a "Batti" (D-052)', () => {
    // Without chains in the catalog, k (which opens the path to z) gets an ordinary entry.
    const noChains: MissionSources = { ...sources, catalog: catalog.filter((entry) => !entry.behindId) };
    for (const random of MORE_RANDOMS) {
      const { content } = randomizeWithMissions(chainMap(), {}, characters, [], EMPTY_TEXT_LIBRARY, ALL, 1, random, noChains);
      expect(['fight', 'defeat']).toContain(content.k?.mission?.type);
      const others = CELLS.filter((cell) => !['k', 'z'].includes(cell))
        .map((cell) => rank(content, cell))
        .filter((value): value is number => value !== null);
      expect(rank(content, 'k')).toBeGreaterThanOrEqual(Math.max(...others));
      expect(rank(content, 'z')).toBeGreaterThanOrEqual(rank(content, 'k') ?? 0);
    }
  });

  it('a mission never loses its target to a later one (spec 034, 2.5)', () => {
    // Two fixed targets that are never drawn: both must be put on the board.
    const twoTargets: MissionSources = {
      ...sources,
      catalog: [
        ...catalog,
        {
          id: 'gohan',
          giver: { characterId: 'gohan' },
          mission: { type: 'goTo', targetId: 'goten', reward: { cellCharacter: true } },
          lines: [],
          weight: 1,
        },
      ],
    };
    for (const random of MORE_RANDOMS) {
      const { content } = randomizeWithMissions(chainMap(), {}, characters, [], EMPTY_TEXT_LIBRARY, ALL, 1, random, twoTargets);
      for (const cell of CELLS) {
        const mission = content[cell]?.mission;
        if (mission?.type === 'goTo' || mission?.type === 'defeat') {
          expect(onBoard(content).has(mission.targetId ?? '')).toBe(true);
        }
      }
    }
  });

  it('on one far cell alone it sees the whole map: a 3v3 can come, and "Vai da" finds a target (spec 034, 2.5)', () => {
    const full = run(RANDOMS[0]).content;
    const fightsOnly: MissionSources = {
      ...sources,
      catalog: [
        { id: 'f1', giver: { group: 'recruitable' }, mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } }, lines: [], weight: 1 },
        { id: 'f2', giver: { group: 'villains' }, mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } }, lines: [], weight: 1 },
      ],
    };
    const alone = randomizeWithMissions(chainMap(), full, characters, [], EMPTY_TEXT_LIBRARY, ['b3'], 1, sequence(0.5), fightsOnly);
    expect(alone.content.b3?.mission?.format).toBe('3v3');

    const goToOnly: MissionSources = {
      ...sources,
      catalog: [
        { id: 'g1', giver: { group: 'recruitable' }, mission: { type: 'goTo', reward: { cellCharacter: true } }, lines: [], weight: 1 },
        { id: 'g2', giver: { group: 'villains' }, mission: { type: 'goTo', reward: { cellCharacter: true } }, lines: [], weight: 1 },
      ],
    };
    const again = randomizeWithMissions(chainMap(), full, characters, [], EMPTY_TEXT_LIBRARY, ['a2'], 1, sequence(0.5), goToOnly);
    expect(again.content.a2?.mission?.type).toBe('goTo');
    expect(onBoard(again.content).has(again.content.a2?.mission?.targetId ?? '')).toBe(true);
  });

  it('a Character cell left without a character keeps no mission and no lines (spec 034, 2.5)', () => {
    const old: Content = Object.fromEntries(
      CELLS.map((cell) => [cell, { lines: ['Vecchia battuta'], mission: { type: 'wait', turns: 2, reward: { coins: 100 } } }]),
    );
    // Only two characters can be drawn: most cells stay empty.
    const few = [character('krilin', 'C-'), character('yamcha', 'C')];
    const { content } = randomize(chainMap(), old, few, [], EMPTY_TEXT_LIBRARY, CELLS, 1, sequence(0.4));
    for (const cell of CELLS) {
      if (!content[cell]?.characterId) {
        expect(content[cell]?.mission).toBeUndefined();
        expect(content[cell]?.lines).toBeUndefined();
      }
    }
    expect(CELLS.filter((cell) => content[cell]?.characterId)).toHaveLength(2);
  });
});

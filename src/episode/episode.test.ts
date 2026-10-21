import { describe, expect, it } from 'vitest';
import type { Character, GameMap } from '../engine';
import { addNode, connect, newMap } from '../editor/mapEdit';
import { checkEpisode, checkMissions, emptyCharacterCells } from './checks';
import {
  EPISODE_FORMAT_VERSION,
  EpisodeFileError,
  parseEpisode,
  serializeEpisode,
  type Episode,
} from './episodeFile';
import { clearCells, distancesFromStarts, tierRank } from './fill';
import { preparationReport, prepareEpisodeContent, withoutEmptyCharacterCells } from './playEpisode';
import { EMPTY_TEXT_LIBRARY, forgetLine, readTextLibrary, rememberLines } from './textLibrary';

/**
 * A start n1, then character cells n2..n5 in a row, a shop n6 joined to n2,
 * an isolated character cell n7 and a passage cell n8 joined to n5.
 */
function lineMap(): GameMap {
  let map = newMap('Linea');
  const types = ['start', 'character', 'character', 'character', 'character', 'shop', 'character', 'empty'] as const;
  types.forEach((type, index) => {
    map = addNode(map, { x: index / 10, y: 0.5 }, type).map;
  });
  for (const [a, b] of [
    ['n1', 'n2'],
    ['n2', 'n3'],
    ['n3', 'n4'],
    ['n4', 'n5'],
    ['n2', 'n6'],
    ['n5', 'n8'],
  ]) {
    map = connect(map, a as string, b as string)?.map ?? map;
  }
  return map;
}

const character = (id: string, tier?: string, price?: number): Character => ({
  id,
  name: id.toUpperCase(),
  ...(tier ? { tier } : {}),
  ...(price !== undefined ? { price } : {}),
});

describe('tiers and distances (spec 007, criteria 1-2)', () => {
  it('C1: tiers go from E to SS+; unknown or missing tiers have no rank', () => {
    const order = ['E', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'SS-', 'SS', 'SS+'];
    const ranks = order.map((tier) => tierRank(tier) as number);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(new Set(ranks).size).toBe(order.length);
    expect(tierRank('Z')).toBeNull();
    expect(tierRank(undefined)).toBeNull();
  });

  it('C2: distance is 0 on starts, grows step by step, Infinity when unreachable', () => {
    const distances = distancesFromStarts(lineMap());
    expect(Object.fromEntries(distances)).toEqual({
      n1: 0,
      n2: 1,
      n3: 2,
      n4: 3,
      n5: 4,
      n6: 2,
      n7: Infinity,
      n8: 5,
    });
  });
});

describe('emptying cells (spec 007)', () => {
  it('empties the chosen cells', () => {
    expect(clearCells({ n2: { characterId: 'weak' }, n3: { lines: ['x'] } }, ['n2'])).toEqual({ n3: { lines: ['x'] } });
  });
});

describe('episode checks (spec 007, 2.6)', () => {
  it('lists characters used twice (cells and shops together) and those missing from the catalog', () => {
    const catalog = [character('goku'), character('vegeta')];
    const issues = checkEpisode(
      { n2: { characterId: 'goku' }, n6: { characterId: 'vegeta', forSale: ['goku', 'ghost'] } },
      catalog,
    );
    expect(issues.map((issue) => issue.kind)).toEqual(['duplicate', 'unknown']);
    expect(issues[0]?.message).toContain('GOKU (2 volte)');
    expect(issues[1]?.message).toContain('ghost');
    expect(checkEpisode({ n2: { characterId: 'goku' } }, catalog)).toEqual([]);
  });
});

describe('guides on the missions (spec 026, criterion 10)', () => {
  const catalog = [character('tapion', 'S-'), character('hildegarn', 'SS+'), character('bulma'), character('trunks', 'B'), character('vegeta', 'A')];

  it('nothing to say when targets are on the board and rewards are not', () => {
    const content = {
      n2: { characterId: 'hildegarn' },
      n3: { characterId: 'tapion', mission: { type: 'defeat' as const, targetId: 'hildegarn', reward: { cellCharacter: true } } },
      n4: { characterId: 'bulma', mission: { type: 'wait' as const, turns: 3, reward: { characters: ['trunks'] } } },
      n6: { forSale: ['vegeta'] },
      n5: { characterId: 'trunks-old', mission: { type: 'bring' as const, targetId: 'vegeta', reward: { coins: 100 } } },
    };
    expect(checkMissions(content, catalog)).toEqual([]);
  });

  it('a target that is not on the board, one to bring that is nowhere, a reward on the board', () => {
    const content = {
      n3: { characterId: 'tapion', mission: { type: 'defeat' as const, targetId: 'hildegarn', reward: {} } },
      n4: { characterId: 'bulma', mission: { type: 'wait' as const, turns: 3, reward: { characters: ['trunks'] } } },
      n5: { characterId: 'trunks', mission: { type: 'bring' as const, targetId: 'vegeta', reward: {} } },
    };
    expect(checkMissions(content, catalog).map((issue) => issue.message)).toEqual([
      "Missioni con l'obiettivo fuori dal tabellone: TAPION (#3) → HILDEGARN.",
      'Da portare, ma né sul tabellone né in un negozio: TRUNKS (#5) → VEGETA.',
      'Premi che stanno anche sul tabellone o in vendita: BULMA (#4) → TRUNKS.',
    ]);
  });
});

describe('empty character cells (spec 013, criterion 3)', () => {
  it('are listed, and become passage cells when a game starts; the others stay', () => {
    const map = lineMap();
    const content = { n2: { characterId: 'weak' }, n3: { lines: ['Solo una battuta'] } };
    expect(emptyCharacterCells(map, content)).toEqual(['n3', 'n4', 'n5', 'n7']);
    const types = Object.fromEntries(withoutEmptyCharacterCells(map, content).nodes.map((n) => [n.id, n.type]));
    expect(types).toEqual({
      n1: 'start',
      n2: 'character',
      n3: 'empty',
      n4: 'empty',
      n5: 'empty',
      n6: 'shop',
      n7: 'empty',
      n8: 'empty',
    });
    const full = { n2: { characterId: 'a' }, n3: { characterId: 'b' }, n4: { characterId: 'c' }, n5: { characterId: 'd' }, n7: { characterId: 'e' } };
    expect(withoutEmptyCharacterCells(map, full)).toBe(map);
  });
});

describe('text library (spec 007, criterion 8; spec 020, criterion 2)', () => {
  it('remembers without duplicates, ignores empty lines and forgets entries', () => {
    let library = rememberLines(EMPTY_TEXT_LIBRARY, ['  Vinci   senza  trasformarti ', '']);
    library = rememberLines(library, ['vinci senza trasformarti', 'Fatti sotto!']);
    expect(library).toEqual({ lines: ['Vinci senza trasformarti', 'Fatti sotto!'] });
    expect(forgetLine(library, 'Vinci senza trasformarti').lines).toEqual(['Fatti sotto!']);
  });

  it('a library saved before D-031 becomes lines: balloons first, then tasks', () => {
    const old = { tasks: ['Vinci in due minuti', 'Fatti sotto!'], balloons: ['Fatti sotto!'] };
    expect(readTextLibrary(old)).toEqual({ lines: ['Fatti sotto!', 'Vinci in due minuti'] });
    expect(readTextLibrary({ lines: ['Una'] })).toEqual({ lines: ['Una'] });
    expect(readTextLibrary({ tasks: 'x' })).toBeNull();
    expect(readTextLibrary(undefined)).toBeNull();
  });
});

describe('episode file (spec 007, criterion 9)', () => {
  const episode: Episode = {
    name: 'Puntata 1',
    map: lineMap(),
    content: {
      n2: { characterId: 'weak', lines: ['Battimi, se ci riesci', 'Vinci in due minuti'] },
      n6: { forSale: ['p1'] },
    },
  };

  it('saved and reloaded it is identical', () => {
    expect(parseEpisode(serializeEpisode(episode))).toEqual(episode);
  });

  it('a damaged or unknown file gives a clear error', () => {
    const text = serializeEpisode(episode);
    expect(() => parseEpisode(text.slice(0, 30))).toThrow(EpisodeFileError);
    expect(() => parseEpisode('{"format":"arkanite-map","version":1}')).toThrow(/non è una puntata/);
    const next = EPISODE_FORMAT_VERSION + 1;
    const newer = text.replace(`"version":${EPISODE_FORMAT_VERSION}`, `"version":${next}`);
    expect(() => parseEpisode(newer)).toThrow(new RegExp(`versione ${next}`));
    const unknownCell = serializeEpisode({ ...episode, content: { zz: { lines: ['x'] } } });
    expect(() => parseEpisode(unknownCell)).toThrow(/mancano parti della puntata/);
  });

  it('copies of special shopkeepers travel with the episode (spec 022, criterion 6)', () => {
    const keeper = { id: 'k1', name: 'Oste', shopkeeper: true, imageData: 'data:image/png;base64,AA' };
    const withKeeper: Episode = { ...episode, content: { ...episode.content, n6: { characterId: 'k1' } }, keepers: [keeper] };
    expect(parseEpisode(serializeEpisode(withKeeper))).toEqual(withKeeper);
    const broken = serializeEpisode({ ...withKeeper, keepers: [{ ...keeper, imageData: 'nope' }] });
    expect(() => parseEpisode(broken)).toThrow(/mancano parti della puntata/);
  });

  it('missions travel with the episode; a damaged mission makes the file unreadable (spec 026)', () => {
    const withMission: Episode = {
      ...episode,
      content: {
        ...episode.content,
        n3: {
          characterId: 'strong',
          mission: { type: 'defeat', targetId: 'weak', reward: { cellCharacter: true, coins: 200 } },
        },
      },
    };
    expect(parseEpisode(serializeEpisode(withMission))).toEqual(withMission);
    const broken = serializeEpisode({
      ...withMission,
      content: { n3: { mission: { type: 'fly', reward: {} } } },
    } as unknown as Episode);
    expect(() => parseEpisode(broken)).toThrow(/mancano parti della puntata/);
  });

  it('a file of version 2 has no shopkeeper copies and is read as before', () => {
    const old = JSON.parse(serializeEpisode(episode)) as { version: number };
    old.version = 2;
    expect(parseEpisode(JSON.stringify(old))).toEqual(episode);
  });

  it('a file of version 1 is read with balloon and task as two lines (D-031)', () => {
    const old = JSON.parse(serializeEpisode(episode)) as {
      version: number;
      episode: { content: Record<string, Record<string, unknown>> };
    };
    old.version = 1;
    old.episode.content.n2 = {
      characterId: 'weak',
      balloon: 'Battimi, se ci riesci',
      task: 'Vinci in due minuti',
    };
    old.episode.content.n3 = { task: 'Solo la task' };
    const read = parseEpisode(JSON.stringify(old));
    expect(read.content.n2).toEqual(episode.content.n2);
    expect(read.content.n3).toEqual({ lines: ['Solo la task'] });
  });
});

describe('playing an episode (spec 007, criteria 10-11)', () => {
  const catalog = [
    character('goku', 'C'),
    character('vegeta', 'B'),
    character('krilin', 'C+', 100),
    character('yamcha', 'D', 50),
    character('cell', 'S', 900),
  ];

  it('C10: characters missing from the catalog are removed and listed', () => {
    const prepared = prepareEpisodeContent(
      { n2: { characterId: 'ghost', lines: ['Vinci'] }, n6: { forSale: ['ghost2', 'cell'] } },
      catalog,
      [],
    );
    expect(prepared.content).toEqual({ n2: { lines: ['Vinci'] }, n6: { forSale: ['cell'] } });
    expect(prepared.missing).toEqual(['ghost', 'ghost2']);
  });

  it('C11: chosen starters are replaced by unused characters of the nearest tier', () => {
    const prepared = prepareEpisodeContent(
      { n2: { characterId: 'goku' }, n3: { characterId: 'vegeta' }, n6: { forSale: ['goku', 'cell'] } },
      catalog,
      ['goku'],
    );
    // In the cell: krilin (C+) is the nearest free tier to goku (C). In the
    // shop krilin is taken and yamcha (D) may not go on sale (spec 022, 2.4):
    // with nobody else fitting, the place stays empty.
    expect(prepared.content.n2?.characterId).toBe('krilin');
    expect(prepared.content.n6?.forSale).toEqual(['cell']);
    expect(prepared.replacements).toEqual([
      { starterName: 'GOKU', replacementName: 'KRILIN', nodeId: 'n2', inShop: false },
      { starterName: 'GOKU', replacementName: null, nodeId: 'n6', inShop: true },
    ]);
  });

  it('the substitute is never someone a mission names: opponent, target or reward (spec 034, 2.5)', () => {
    const prepared = prepareEpisodeContent(
      {
        n2: { characterId: 'goku' },
        n3: { characterId: 'vegeta', mission: { type: 'goTo', targetId: 'krilin', reward: { cellCharacter: true } } },
      },
      catalog,
      ['goku'],
    );
    // krilin (C+) would be the nearest tier, but it is the target of a mission.
    expect(prepared.content.n2?.characterId).not.toBe('krilin');
  });

  it('without a substitute the place stays empty', () => {
    const prepared = prepareEpisodeContent({ n2: { characterId: 'goku' } }, [character('goku', 'C')], ['goku']);
    expect(prepared.content.n2?.characterId).toBeUndefined();
    expect(prepared.replacements[0]?.replacementName).toBeNull();
  });

  it('tells the director what changed: missing characters and replaced starters', () => {
    const report = preparationReport({
      content: {},
      missing: ['ghost'],
      replacements: [
        { starterName: 'GOKU', replacementName: 'KRILIN', nodeId: 'n2', inShop: false },
        { starterName: 'GOKU', replacementName: null, nodeId: 'n6', inShop: true },
      ],
    });
    expect(report).toEqual([
      'Non sono nel catalogo attuale e i loro posti partono vuoti: ghost.',
      'Starter GOKU tolto dalla casella #2: al suo posto KRILIN.',
      'Starter GOKU tolto dal negozio #6: nessun sostituto disponibile, il posto resta vuoto.',
    ]);
    expect(preparationReport({ content: {}, missing: [], replacements: [] })).toEqual([]);
  });
});

describe('the starter that leaves the map (spec 022, 2.4 and criterion 12)', () => {
  const list: Character[] = [
    character('goku', 'C'),
    { id: 'roshi', name: 'ROSHI', tier: 'D+', shopkeeper: true },
    { id: 'kami', name: 'KAMI', shopkeeper: true },
    character('story'),
    character('weakE', 'E', 10),
    character('weakD', 'D', 20),
    character('tien', 'C+'),
    character('raditz', 'B-', 1500),
  ];

  it('in a cell: a recruitable character from C- up, never a shopkeeper, of the nearest tier', () => {
    // Nearest to goku (C) by tier would be weakD (D) or roshi (D+); both are out.
    const prepared = prepareEpisodeContent({ c1: { characterId: 'goku' } }, list, ['goku']);
    expect(prepared.content.c1?.characterId).toBe('tien');
  });

  it('for sale: the same, with a price', () => {
    const prepared = prepareEpisodeContent({ sh: { forSale: ['goku'] } }, list, ['goku'], new Set(['sh']));
    expect(prepared.content.sh?.forSale).toEqual(['raditz']);
  });

  it('as a shopkeeper: another free shopkeeper', () => {
    const prepared = prepareEpisodeContent(
      { sh1: { characterId: 'roshi', forSale: [] }, c1: { characterId: 'tien' } },
      list,
      ['roshi'],
      new Set(['sh1']),
    );
    expect(prepared.content.sh1?.characterId).toBe('kami');
    // The message says the starter kept a shop (spec 023, 2.2).
    expect(preparationReport(prepared)).toEqual([
      'Starter ROSHI tolto dal negozio #sh1, dove faceva il negoziante: al suo posto KAMI.',
    ]);
  });

  it('without a fitting substitute the place stays empty', () => {
    const onlyWeak = [character('goku', 'C'), character('weakE', 'E'), character('story')];
    const prepared = prepareEpisodeContent({ c1: { characterId: 'goku' } }, onlyWeak, ['goku']);
    expect(prepared.content.c1?.characterId).toBeUndefined();
    expect(prepared.replacements[0]?.replacementName).toBeNull();
  });
});

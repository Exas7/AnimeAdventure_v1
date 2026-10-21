import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, testCatalog, testItems, testMap, testSetup, type CellContent } from '../engine';
import { countFor, missionRows } from './missionList';

/** The test map's content: c1..c4 from the old formats, plus missions of every kind. */
const content: Record<string, CellContent> = {
  c3: {
    characterId: 'char-c',
    lines: ['Rispondi bene!', 'E vengo con te.'],
    mission: {
      type: 'quiz',
      quiz: { question: 'Chi è il padre di Goten?', answers: ['Vegeta', 'Goku', 'Gohan'], correct: 1 },
      reward: { cellCharacter: true, coins: 200 },
    },
  },
  c1: { characterId: 'char-a', format: '1v1', lines: ['Battimi!'] },
  c2: { characterId: 'char-b' },
  c4: { characterId: 'char-d', mission: { type: 'defeat', targetId: 'char-a', reward: {} } },
  sh1: { characterId: 'keeper-1', forSale: ['char-e'] },
};

describe('the list of the missions of an episode (spec 029)', () => {
  it('one row per cell with a character, in cell order, as in the scene (criterion 1)', () => {
    const rows = missionRows(testMap, content, testCatalog, testItems);
    expect(rows.map((row) => [row.cell, row.character, row.mission, row.reward])).toEqual([
      ['#c1', 'Personaggio A', 'Combattimento 1v1', 'Personaggio A'],
      ['#c2', 'Personaggio B', '—', '—'],
      ['#c3', 'Personaggio C', 'Quiz', 'Personaggio C, 200 monete'],
      ['#c4', 'Personaggio D', 'Missione · Batti Personaggio A', '—'],
    ]);
    expect(rows[2]?.lines).toEqual(['Rispondi bene!', 'E vengo con te.']);
    expect(rows.every((row) => row.status === undefined)).toBe(true);
  });

  it('quiz rows carry the question, the answers and the right one (criterion 2)', () => {
    const quiz = missionRows(testMap, content, testCatalog, testItems).find((row) => row.kind === 'quiz');
    expect(quiz?.quiz).toEqual({ question: 'Chi è il padre di Goten?', answers: ['Vegeta', 'Goku', 'Gohan'], correct: 1 });
  });

  it('filters count their rows; an old format counts as a fight (criterion 3)', () => {
    const rows = missionRows(testMap, content, testCatalog, testItems);
    expect(countFor(rows, 'all')).toBe(4);
    expect(countFor(rows, 'fight')).toBe(1);
    expect(countFor(rows, 'quiz')).toBe(1);
    expect(countFor(rows, 'defeat')).toBe(1);
    expect(countFor(rows, 'none')).toBe(1);
    expect(countFor(rows, 'wait')).toBe(0);
  });

  it('in a game: free, in progress with who accepted it, completed by whom (criterion 4)', () => {
    let game = createGame(testSetup());
    game = act(game, {
      type: 'setCellContent',
      nodeId: 'c3',
      content: { characterId: 'char-c', mission: { type: 'wait', turns: 2, reward: { coins: 100 } } },
    });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p2' });
    game = act(game, { type: 'setConquest', nodeId: 'c2', player: 'p2' });
    const state = currentState(game);
    const rows = missionRows(game.map, state.cells, game.catalog, game.items, state);
    expect(Object.fromEntries(rows.map((row) => [row.cell, row.status]))).toEqual({
      '#c1': { kind: 'free' },
      '#c2': { kind: 'done', player: 'p2' },
      '#c3': { kind: 'active', players: ['p1', 'p2'] },
      '#c4': { kind: 'free' },
    });
    expect([countFor(rows, 'free'), countFor(rows, 'active'), countFor(rows, 'done')]).toEqual([2, 1, 1]);
  });
});

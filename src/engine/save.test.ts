import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, undo } from './game';
import { powerCatalog } from './powers';
import { parseGame, SAVE_FORMAT_VERSION, SaveFileError, serializeGame } from './save';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

function playedGame(): Game {
  return play(
    createGame(testSetup({ p1Powers: [powerCatalog.coinsPerInteraction(200)] })),
    { type: 'move', to: 'n1' },
    { type: 'interact', nodeId: 'c1' },
    { type: 'setConquest', nodeId: 'c1', player: 'p1' },
    { type: 'endTurn' },
  );
}

function expectSaveError(text: string, message: RegExp): void {
  expect(() => parseGame(text)).toThrow(SaveFileError);
  expect(() => parseGame(text)).toThrow(message);
}

describe('save and load (spec 001, criteria 19-20)', () => {
  it('reads files of format version 1 and brings them up to date', () => {
    const game = playedGame();
    const file = JSON.parse(serializeGame(game)) as {
      version: number;
      game: { history: { state: Record<string, unknown> }[] };
    };
    file.version = 1;
    for (const entry of file.game.history) {
      delete entry.state.acknowledgedThisTurn;
    }
    const loaded = parseGame(JSON.stringify(file));
    expect(currentState(loaded).acknowledgedThisTurn).toEqual([]);
    expect(currentState(loaded).players).toEqual(currentState(game).players);
  });

  it('reads files of format version 2: cell content moves from the map to the game (D-016)', () => {
    const game = playedGame();
    const file = JSON.parse(serializeGame(game)) as {
      version: number;
      game: {
        map: { nodes: Record<string, unknown>[] };
        history: { state: Record<string, unknown> }[];
      };
    };
    // Rebuild the version 2 shape: content inside the map nodes, no cells in the
    // state, and one balloon and one task instead of lines (before D-031).
    const cells = currentState(game).cells;
    for (const node of file.game.map.nodes) {
      const { lines, ...rest } = cells[node.id as string] ?? {};
      Object.assign(node, rest, lines ? { balloon: lines[0], task: lines[1] } : {});
      if (cells[node.id as string]?.characterId && node.type === 'empty') {
        node.type = 'character';
      }
    }
    for (const entry of file.game.history) {
      delete entry.state.cells;
    }
    file.version = 2;

    const loaded = parseGame(JSON.stringify(file));
    expect(currentState(loaded).cells).toEqual(currentState(game).cells);
    expect(loaded.map).toEqual(game.map);
  });

  it('reads files of format version 3: balloon and task become two lines (D-031)', () => {
    const game = play(playedGame(), {
      type: 'setCellContent',
      nodeId: 'n1',
      content: { characterId: 'char-e', lines: ['Eccomi', 'Vinci'] },
    });
    const file = JSON.parse(serializeGame(game)) as {
      version: number;
      game: {
        history: {
          action: Record<string, unknown>;
          state: { cells: Record<string, Record<string, unknown>> };
        }[];
      };
    };
    // Rebuild the version 3 shape: one balloon and one task in every cell.
    const toOldTexts = (cell: Record<string, unknown>) => {
      const [balloon, task] = (cell.lines as string[] | undefined) ?? [];
      delete cell.lines;
      Object.assign(cell, balloon ? { balloon } : {}, task ? { task } : {});
    };
    for (const entry of file.game.history) {
      Object.values(entry.state.cells).forEach(toOldTexts);
      if (entry.action.type === 'setCellContent') {
        toOldTexts(entry.action.content as Record<string, unknown>);
      }
    }
    file.version = 3;

    const loaded = parseGame(JSON.stringify(file));
    expect(loaded).toEqual(game);
    expect(currentState(loaded).cells.c1?.lines).toEqual([
      'Battimi se ci riesci!',
      'Vinci senza trasformazioni',
    ]);
  });

  it('C19: save and reload gives an identical game, and undo still works', () => {
    const game = playedGame();
    const loaded = parseGame(serializeGame(game));
    expect(loaded).toEqual(game);

    const undone = undo(loaded);
    expect(currentState(undone)).toEqual(currentState(undo(game)));
    expect(currentState(undone).currentPlayer).toBe('p1');
  });

  it('reads files of format version 4 as they are: the missions of version 5 are optional (spec 038)', () => {
    const game = playedGame();
    const file = JSON.parse(serializeGame(game)) as { version: number };
    file.version = 4;
    expect(parseGame(JSON.stringify(file))).toEqual(parseGame(serializeGame(game)));
  });

  it('C20: a damaged or unknown file gives a clear error', () => {
    const saved = serializeGame(playedGame());

    expectSaveError(saved.slice(0, saved.length / 2), /danneggiato/);
    expectSaveError('{"hello": "world"}', /non è un salvataggio/);
    // The version is read from the program, as in the episode test (spec 038).
    const version = `"version":${SAVE_FORMAT_VERSION}`;
    expectSaveError(
      saved.replace(version, '"version":99'),
      new RegExp(`versione 99 .*solo fino alla versione ${SAVE_FORMAT_VERSION}`),
    );
    expectSaveError(saved.replace(version, '"version":"uno"'), /manca la versione/);

    const withoutHistory = JSON.parse(saved) as { game: { history: unknown } };
    withoutHistory.game.history = [];
    expectSaveError(JSON.stringify(withoutHistory), /mancano parti della partita/);
  });
});

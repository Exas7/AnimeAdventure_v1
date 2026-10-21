import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { turnRuleWarnings } from './rules';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

describe('cell content (spec 004, criteria 2-4, D-016)', () => {
  it('changes character, lines and format; it is logged and undoable', () => {
    const start = createGame(testSetup({ startingCoins: 1000 }));
    const game = act(start, {
      type: 'setCellContent',
      nodeId: 'n1',
      content: { characterId: 'char-e', lines: [' Eccomi ', '', 'Vinci senza trasformarti'], format: '2v2' },
    });
    // Lines are trimmed and empty ones dropped (D-031).
    expect(currentState(game).cells.n1).toEqual({
      characterId: 'char-e',
      lines: ['Eccomi', 'Vinci senza trasformarti'],
      format: '2v2',
    });
    expect(gameLog(game).at(-1)?.text).toBe("Casella #1: ora c'è Personaggio E");
    expect(currentState(undo(game)).cells.n1).toBeUndefined();
  });

  it('removing the character empties the cell', () => {
    const game = act(createGame(testSetup()), { type: 'setCellContent', nodeId: 'c1', content: {} });
    expect(currentState(game).cells.c1).toBeUndefined();
    expect(gameLog(game).at(-1)?.text).toBe('Casella #c1: personaggio tolto');
  });

  it('a character already elsewhere is placed anyway, with a warning', () => {
    const onMap = act(createGame(testSetup()), {
      type: 'setCellContent',
      nodeId: 'n2',
      content: { characterId: 'char-a' },
    });
    expect(lastWarnings(onMap)).toEqual([
      { kind: 'characterAlreadyPlaced', message: 'Personaggio A è già sulla casella #c1' },
    ]);
    expect(currentState(onMap).cells.n2?.characterId).toBe('char-a');

    const inShop = act(createGame(testSetup()), {
      type: 'setCellContent',
      nodeId: 'n2',
      content: { characterId: 'char-g' },
    });
    expect(lastWarnings(inShop)[0]?.message).toBe(
      'Personaggio G è già in vendita nel negozio di Negoziante Due',
    );
  });

  it('keeping the same character gives no warning', () => {
    const game = act(createGame(testSetup()), {
      type: 'setCellContent',
      nodeId: 'c1',
      content: { characterId: 'char-a', lines: ['Nuova battuta'] },
    });
    expect(lastWarnings(game)).toEqual([]);
    expect(gameLog(game).at(-1)?.text).toBe('Casella #c1: contenuto modificato');
  });

  it('a character added to a shop during the game is sold at the catalog price', () => {
    const game = play(
      createGame(testSetup({ startingCoins: 1000 })),
      { type: 'setCellContent', nodeId: 'sh1', content: { characterId: 'keeper-1', forSale: ['char-h'] } },
      { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-h' },
    );
    expect(currentState(game).players.p1.coins).toBe(1000 - 800);
    expect(currentState(game).players.p1.team).toContain('char-h');
  });

  it('a character without a price put in a shop is sold at 0 (spec 005, criterion 9)', () => {
    const setup = testSetup({ startingCoins: 500 });
    const game = play(
      createGame({ ...setup, catalog: [...setup.catalog, { id: 'satan', name: 'Mr. Satan' }] }),
      { type: 'setCellContent', nodeId: 'sh1', content: { forSale: ['satan'] } },
      { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'satan' },
    );
    expect(currentState(game).players.p1.coins).toBe(500);
    expect(currentState(game).players.p1.team).toContain('satan');
  });

  it('only shops can sell, and only catalog characters can be placed', () => {
    const game = createGame(testSetup());
    expect(() =>
      act(game, { type: 'setCellContent', nodeId: 'n1', content: { forSale: ['char-e'] } }),
    ).toThrow(EngineError);
    expect(() =>
      act(game, { type: 'setCellContent', nodeId: 'n1', content: { characterId: 'nobody' } }),
    ).toThrow(EngineError);
  });

  it('a passage cell with a character can be interacted with like any other', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'setCellContent', nodeId: 'n1', content: { characterId: 'char-e' } },
      { type: 'move', to: 'n1' },
      { type: 'interact', nodeId: 'n1' },
    );
    expect(gameLog(game).at(-1)?.text).toBe('G1 interagisce con Personaggio E');
    expect(lastWarnings(game)).toEqual([]);
  });
});

describe('purchases checked before buying (spec 004, criterion 6, D-015)', () => {
  it('warns without buying, once per turn for each kind', () => {
    let game = play(
      createGame(
        testSetup({ startingCoins: 5000, p1Powers: [powerCatalog.extraActionsOnDemand(2, 1)] }),
      ),
      { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' },
      { type: 'buyItem', shopNodeId: 'sh1', itemId: 'heavy-clothes' },
      { type: 'buyItem', shopNodeId: 'sh1', itemId: 'senzu' },
    );
    const check = (action: GameAction) =>
      turnRuleWarnings(currentState(game), action, game).map((warning) => warning.kind);

    expect(check({ type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' })).toEqual([
      'characterAlreadySold',
    ]);
    expect(check({ type: 'buyItem', shopNodeId: 'sh2', itemId: 'heavy-clothes' })).toEqual([
      'itemAlreadyBought',
    ]);
    expect(check({ type: 'buyItem', shopNodeId: 'sh1', itemId: 'senzu' })).toEqual([
      'itemSoldOut',
    ]);
    // Checking does not buy anything.
    expect(currentState(game).players.p1.team).toEqual(['hero-1', 'char-e']);

    for (const characterId of ['char-a', 'char-b', 'char-c']) {
      game = act(game, { type: 'addCharacter', player: 'p1', characterId });
    }
    expect(check({ type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-f' })).toEqual([
      'teamFull',
    ]);

    game = act(game, { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-f' });
    expect(lastWarnings(game).map((warning) => warning.kind)).toEqual(['teamFull']);
    expect(check({ type: 'buyCharacter', shopNodeId: 'sh2', characterId: 'char-g' })).toEqual([]);
  });

  it('warns about a Senzu that would have no effect', () => {
    const game = createGame(testSetup({ startingCoins: 1000 }));
    const senzu: GameAction = { type: 'buyItem', shopNodeId: 'sh2', itemId: 'senzu' };
    expect(turnRuleWarnings(currentState(game), senzu, game)).toEqual([
      { kind: 'nothingToRecharge', message: 'Lo starter di G1 non ha poteri da ricaricare' },
    ]);
  });
});

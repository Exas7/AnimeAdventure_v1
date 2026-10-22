import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { parseGame, serializeGame } from './save';
import { shopListing } from './shop';
import { testSetup, type TestSetupOptions } from './testMap';
import type { Game, GameAction, PlayerId } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

function newGame(options: TestSetupOptions = {}): Game {
  return createGame(testSetup({ startingCoins: 1000, ...options }));
}

function listing(game: Game, shopNodeId: string, viewer: PlayerId) {
  return shopListing(currentState(game), game, shopNodeId, viewer);
}

const buyE: GameAction = { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' };
const endTurn: GameAction = { type: 'endTurn' };

function buyItem(itemId: string, shopNodeId = 'sh1'): GameAction {
  return { type: 'buyItem', shopNodeId, itemId };
}

describe('shop: characters (spec 002, criteria 1-6)', () => {
  it("S1: buying a character takes its price from the current player's coins and adds it to the team", () => {
    const game = act(newGame(), buyE);
    const p1 = currentState(game).players.p1;
    expect(p1.coins).toBe(700);
    expect(p1.team).toEqual(['hero-1', 'char-e']);
    expect(gameLog(game).at(-1)?.text).toBe('G1 compra Personaggio E per 300 monete');
  });

  it('S2: a price changed by hand during the game is the one charged', () => {
    const game = play(
      newGame(),
      { type: 'setCharacterPrice', characterId: 'char-e', price: 150 },
      buyE,
    );
    expect(currentState(game).players.p1.coins).toBe(850);
    expect(listing(game, 'sh1', 'p2').characters[0]?.price).toBe(150);
  });

  it('S3: buying without enough coins works and the balance goes below zero', () => {
    const game = act(
      newGame({ startingCoins: 0 }),
      { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-f' },
    );
    expect(currentState(game).players.p1.coins).toBe(-500);
    expect(lastWarnings(game)).toEqual([]);
  });

  it('S4: buying uses no actions and does not fire "per interaction" powers', () => {
    const start = newGame({ p1Powers: [powerCatalog.coinsPerInteraction(200)] });
    const game = play(start, buyE, buyItem('flying-nimbus'));
    const state = currentState(game);
    expect(state.actions).toEqual(currentState(start).actions);
    expect(state.players.p1.coins).toBe(1000 - 300 - 250);
    expect(state.notifications).toEqual([]);
  });

  it('S5: a bought character shows as sold to the opponent, who can still buy it with a warning', () => {
    let game = play(newGame(), buyE, endTurn);
    expect(listing(game, 'sh1', 'p2').characters).toEqual([
      { characterId: 'char-e', name: 'Personaggio E', price: 300, soldTo: 'p1' },
      { characterId: 'char-f', name: 'Personaggio F', price: 500, soldTo: null },
    ]);

    game = act(game, buyE);
    expect(lastWarnings(game)).toEqual([
      { kind: 'characterAlreadySold', message: 'G1 ha già comprato Personaggio E' },
    ]);
    expect(currentState(game).players.p2.team).toContain('char-e');
  });

  it('S6: with a full team the first purchase is the sixth (spec 061, D-091); after it a bought character joins as an extra, with a warning', () => {
    let game = newGame();
    for (const characterId of ['char-a', 'char-b', 'char-c', 'char-d']) {
      game = act(game, { type: 'addCharacter', player: 'p1', characterId });
    }
    game = act(game, buyE);
    expect(lastWarnings(game)).toEqual([]);
    expect(currentState(game).players.p1.team).toHaveLength(6);

    game = act(game, { type: 'removeCharacter', player: 'p1', characterId: 'char-a' });
    game = act(game, { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-f' });
    expect(lastWarnings(game).map((w) => w.kind)).toEqual(['teamFull']);
    expect(currentState(game).players.p1.team).toHaveLength(6);
  });
});

describe('shop: items (spec 002, criteria 7-12)', () => {
  it('S7: a bought item goes to the inventory; the host can remove it and add it back', () => {
    let game = act(newGame(), buyItem('flying-nimbus'));
    expect(currentState(game).players.p1.inventory).toEqual(['flying-nimbus']);

    game = act(game, { type: 'removeFromInventory', player: 'p1', itemId: 'flying-nimbus' });
    expect(currentState(game).players.p1.inventory).toEqual([]);

    game = act(game, { type: 'addToInventory', player: 'p1', itemId: 'flying-nimbus' });
    expect(currentState(game).players.p1.inventory).toEqual(['flying-nimbus']);
  });

  it('S8: a Senzu gives one use back to the manual power of the starter', () => {
    let game = newGame({
      p1Powers: [powerCatalog.extraActionsOnDemand(2, 1, 'Doppio movimento')],
    });
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(currentState(game).players.p1.powers[0]?.usesLeft).toBe(0);

    game = act(game, buyItem('senzu'));
    const state = currentState(game);
    expect(state.players.p1.powers[0]?.usesLeft).toBe(1);
    expect(state.players.p1.inventory).toEqual([]);
    expect(state.notifications.at(-1)?.text).toBe('G1 · Senzu: Doppio movimento +1 uso');
  });

  it('S9: a Senzu pays the extra starting coins again', () => {
    const game = act(
      newGame({ startingCoins: 0, p1Powers: [powerCatalog.extraStartingCoins(500)] }),
      buyItem('senzu'),
    );
    expect(currentState(game).players.p1.coins).toBe(500 - 300 + 500);
  });

  it('S10: a Senzu for a starter with nothing to recharge is bought with no effect and a warning', () => {
    const game = act(newGame({ p1Powers: [powerCatalog.coinsAtTurnEnd(100)] }), buyItem('senzu'));
    expect(lastWarnings(game)).toEqual([
      { kind: 'nothingToRecharge', message: 'Lo starter di G1 non ha poteri da ricaricare' },
    ]);
    expect(currentState(game).players.p1.coins).toBe(700);
    expect(currentState(game).players.p1.inventory).toEqual([]);
  });

  it('S11: a Senzu bought in a shop is sold out there and still available in the other one', () => {
    let game = play(newGame(), buyItem('senzu', 'sh1'), endTurn);
    const senzuIn = (shop: string) =>
      listing(game, shop, 'p2').items.find((item) => item.itemId === 'senzu');
    expect(senzuIn('sh1')?.soldOut).toBe(true);
    expect(senzuIn('sh2')?.soldOut).toBe(false);

    game = act(game, buyItem('senzu', 'sh1'));
    expect(lastWarnings(game).map((w) => w.kind)).toEqual(['itemSoldOut', 'nothingToRecharge']);
    expect(lastWarnings(game)[0]?.message).toBe('In questo negozio non ci sono più copie di Senzu');

    // Same turn, other shop: still available there; the "nothing to recharge"
    // warning is not repeated in the same turn (D-015).
    game = act(game, buyItem('senzu', 'sh2'));
    expect(lastWarnings(game).map((w) => w.kind)).toEqual([]);
  });

  it('S12: a once-per-player item shows as already bought for the buyer only; buying it again warns', () => {
    let game = act(newGame(), buyItem('heavy-clothes', 'sh1'));
    const clothesFor = (viewer: PlayerId) =>
      listing(game, 'sh2', viewer).items.find((item) => item.itemId === 'heavy-clothes');
    expect(clothesFor('p1')?.alreadyBought).toBe(true);
    expect(clothesFor('p2')?.alreadyBought).toBe(false);

    game = act(game, buyItem('heavy-clothes', 'sh2'));
    expect(lastWarnings(game)).toEqual([
      {
        kind: 'itemAlreadyBought',
        message: 'G1 ha già comprato Vestiti pesanti da allenamento',
      },
    ]);
    expect(currentState(game).players.p1.inventory).toEqual(['heavy-clothes', 'heavy-clothes']);
  });
});

describe('shop: undo and save (spec 002, criteria 13-14)', () => {
  it('S13: undoing a purchase restores coins, team or inventory, Senzu effect and availability', () => {
    const before = play(
      newGame({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 1, 'Doppio movimento')] }),
      { type: 'usePower', player: 'p1', powerId: 'p1-0' },
    );
    for (const purchase of [buyE, buyItem('senzu'), buyItem('heavy-clothes')]) {
      const after = act(before, purchase);
      expect(currentState(after)).not.toEqual(currentState(before));
      expect(currentState(undo(after))).toEqual(currentState(before));
      expect(listing(undo(after), 'sh1', 'p1')).toEqual(listing(before, 'sh1', 'p1'));
    }
  });

  it('S14: save and reload keeps shops, prices and inventories', () => {
    const game = play(
      newGame(),
      { type: 'setItemPrice', itemId: 'flying-nimbus', price: 999 },
      { type: 'setCharacterPrice', characterId: 'char-g', price: 50 },
      buyE,
      buyItem('flying-nimbus'),
      buyItem('senzu', 'sh2'),
      endTurn,
    );
    const loaded = parseGame(serializeGame(game));
    expect(loaded).toEqual(game);
    for (const shop of ['sh1', 'sh2']) {
      expect(listing(loaded, shop, 'p2')).toEqual(listing(game, shop, 'p2'));
    }
    expect(currentState(loaded).players.p1.inventory).toEqual(['flying-nimbus']);
    expect(listing(loaded, 'sh2', 'p1').characters[0]?.price).toBe(50);
  });
});

describe('shop: references', () => {
  it('rejects a character that is not sold in that shop, or a cell that is not a shop', () => {
    const game = newGame();
    expect(() =>
      act(game, { type: 'buyCharacter', shopNodeId: 'sh2', characterId: 'char-e' }),
    ).toThrow(EngineError);
    expect(() => act(game, buyItem('senzu', 'n1'))).toThrow(EngineError);
  });

  it('describes the shopkeeper in the log', () => {
    const game = act(newGame(), { type: 'move', to: 'sh1' });
    expect(gameLog(game).at(-1)?.text).toBe('G1 si sposta su negozio di Negoziante Uno');
  });
});

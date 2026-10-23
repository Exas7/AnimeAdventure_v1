import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { travelRule } from './itemUse';
import { gameLog } from './log';
import { missionsDone } from './missions';
import { powerCatalog } from './powers';
import { reachableCells, turnRuleWarnings } from './rules';
import { testItems, testMap, testSetup, type TestSetupOptions } from './testMap';
import type { Game, GameAction, Mission } from './types';

function newGame(options: TestSetupOptions = {}): Game {
  return createGame(testSetup({ startingCoins: 1000, ...options }));
}

function withItem(game: Game, itemId: string): Game {
  return act(game, { type: 'addToInventory', player: 'p1', itemId });
}

/** As the director does: the turn rules warn first, a second click does it (D-013). */
function warningsOf(game: Game, action: GameAction): string[] {
  return turnRuleWarnings(currentState(game), action, game).map((warning) => warning.message);
}

const nimbusTo = (to: string): GameAction => ({ type: 'useItem', player: 'p1', itemId: 'flying-nimbus', to });

describe('"Usa" on the Senzu (spec 047, 2.1)', () => {
  it('C1: recharges as when bought, leaves the inventory, costs no action; one undo puts it back', () => {
    let game = newGame({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 1, 'Doppio movimento')] });
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    const before = withItem(game, 'senzu');
    expect(warningsOf(before, { type: 'useItem', player: 'p1', itemId: 'senzu' })).toEqual([]);

    game = act(before, { type: 'useItem', player: 'p1', itemId: 'senzu' });
    const state = currentState(game);
    expect(state.players.p1.powers[0]?.usesLeft).toBe(1);
    expect(state.players.p1.inventory).toEqual([]);
    expect(state.notifications.at(-1)?.text).toBe('G1 · Senzu: Doppio movimento +1 uso');
    expect(state.actions).toEqual(currentState(before).actions);
    expect(gameLog(game).at(-1)?.text).toBe('G1 usa Senzu');

    expect(currentState(undo(game)).players.p1).toEqual(currentState(before).players.p1);
  });

  it('C2: with nothing to recharge it warns first, then is used with no effect', () => {
    const game = withItem(newGame({ p1Powers: [powerCatalog.coinsAtTurnEnd(100)] }), 'senzu');
    const use: GameAction = { type: 'useItem', player: 'p1', itemId: 'senzu' };
    expect(warningsOf(game, use)).toEqual(['Lo starter di G1 non ha poteri da ricaricare']);
    const used = act(game, use);
    expect(currentState(used).players.p1.inventory).toEqual([]);
    expect(currentState(used).players.p1.coins).toBe(1000);
  });
});

describe('where Nuvola Speedy and Trasmissione Istantanea take the pawn (spec 047, 2.2)', () => {
  it('C3: the Nuvola goes at most 7 paths away, the Trasmissione any distance', () => {
    const items = new Map(testItems.map((item) => [item.id, item]));
    expect(travelRule(items.get('flying-nimbus') as (typeof testItems)[number])).toEqual({ steps: 7 });
    expect(travelRule(items.get('instant-transmission') as (typeof testItems)[number])).toEqual({ steps: null });

    const state = currentState(newGame());
    expect([...reachableCells(testMap, state, 'p1', 2)].sort()).toEqual(['c1', 'c2', 'n1', 'n2', 'sh1']);
    // Neither the own cell nor the opponent's (spec 086).
    expect(reachableCells(testMap, state, 'p1', null).size).toBe(testMap.nodes.length - 2);
    expect(reachableCells(testMap, state, 'p1', null).has('s1')).toBe(false);
  });

  it('C3: a grey road closed for the player stops the way, one open for them lets it through', () => {
    let game = newGame();
    // n3 and what lies beyond can be reached only through the grey road c1 – n3.
    for (const edgeId of ['e7', 'e9']) {
      game = act(game, { type: 'setEdgeLock', edgeId, players: 'p1', locked: true });
    }
    expect([...reachableCells(testMap, currentState(game), 'p1', null)].sort()).toEqual([
      'c1',
      'c2',
      'n1',
      'n2',
      'sh1',
    ]);
    expect(reachableCells(testMap, currentState(game), 'p2', null).has('n3')).toBe(true);

    game = act(game, { type: 'setEdgeLock', edgeId: 'e8', players: 'p1', locked: false });
    expect(reachableCells(testMap, currentState(game), 'p1', null).has('n5')).toBe(true);
  });
});

describe('moving with Nuvola Speedy and Trasmissione Istantanea (spec 047, 2.2)', () => {
  it('C4: within reach no "not adjacent" warning; one action, the item used up, notification and log', () => {
    const before = withItem(newGame(), 'flying-nimbus');
    expect(warningsOf(before, nimbusTo('n3'))).toEqual([]);

    const game = act(before, nimbusTo('n3'));
    const state = currentState(game);
    expect(state.players.p1.position).toBe('n3');
    expect(state.actions.used).toBe(currentState(before).actions.used + 1);
    expect(state.players.p1.inventory).toEqual([]);
    expect(state.notifications.at(-1)?.text).toMatch(/^G1 · Nuvola Speedy: su /);
    expect(gameLog(game).at(-1)?.text).toMatch(/^G1 usa Nuvola Speedy: va su /);
    expect(gameLog(game).at(-1)?.details).toEqual([]);

    expect(currentState(undo(game)).players.p1).toEqual(currentState(before).players.p1);
    expect(currentState(undo(game)).actions).toEqual(currentState(before).actions);
  });

  it('C4: the Trasmissione reaches a far cell the same way', () => {
    const game = act(withItem(newGame(), 'instant-transmission'), {
      type: 'useItem',
      player: 'p1',
      itemId: 'instant-transmission',
      to: 'n5',
    });
    expect(currentState(game).players.p1.position).toBe('n5');
    expect(lastWarnings(game)).toEqual([]);
  });

  it('C5: beyond the reach it warns first, then the pawn goes and the item is used up', () => {
    let game = withItem(newGame(), 'flying-nimbus');
    for (const edgeId of ['e7', 'e9']) {
      game = act(game, { type: 'setEdgeLock', edgeId, players: 'p1', locked: true });
    }
    expect(warningsOf(game, nimbusTo('n3'))).toEqual(['Casella fuori dalla portata della Nuvola Speedy']);
    game = act(game, nimbusTo('n3'));
    expect(currentState(game).players.p1.position).toBe('n3');
    expect(currentState(game).players.p1.inventory).toEqual([]);
  });

  it('C6: with the actions of the turn used up, the usual warning', () => {
    let game = withItem(newGame(), 'flying-nimbus');
    game = act(game, { type: 'setActions', actions: { used: 2 } });
    expect(warningsOf(game, nimbusTo('n3'))).toEqual(['G1 ha già usato tutte le azioni del turno']);
  });

  it('out of turn the pawn moves as a correction: no action counted', () => {
    let game = act(newGame(), { type: 'addToInventory', player: 'p2', itemId: 'flying-nimbus' });
    const before = currentState(game).actions;
    game = act(game, { type: 'useItem', player: 'p2', itemId: 'flying-nimbus', to: 'n3' });
    expect(currentState(game).players.p2.position).toBe('n3');
    expect(currentState(game).actions).toEqual(before);
  });

  it('C7: arriving with the item completes a "Vai da"', () => {
    let game = withItem(newGame(), 'instant-transmission');
    const mission: Mission = { type: 'goTo', targetId: 'char-a', reward: { coins: 300 } };
    game = act(game, { type: 'setCellContent', nodeId: 'c3', content: { ...currentState(game).cells.c3, mission } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    game = act(game, { type: 'useItem', player: 'p1', itemId: 'instant-transmission', to: 'c1' });
    expect(missionsDone(currentState(game)).map((active) => active.nodeId)).toEqual(['c3']);
  });

  it('an item that is not in the inventory, or cannot be used this way, is an error', () => {
    const game = withItem(newGame(), 'heavy-clothes');
    expect(() => act(game, nimbusTo('n3'))).toThrow();
    expect(() => act(game, { type: 'useItem', player: 'p1', itemId: 'heavy-clothes' })).toThrow();
    expect(() => act(game, { type: 'useItem', player: 'p1', itemId: 'heavy-clothes', to: 'n3' })).toThrow();
  });
});

describe('trips do not hunt the opponent (spec 086, D-108)', () => {
  const warningKinds = (game: Game, action: GameAction) =>
    turnRuleWarnings(currentState(game), action, game).map((warning) => warning.kind);

  it("a trip never ends on the opponent's cell: not offered, and refused with a warning", () => {
    const game = withItem(newGame(), 'instant-transmission');
    const toOpponent: GameAction = { type: 'useItem', player: 'p1', itemId: 'instant-transmission', to: 's2' };
    expect(reachableCells(testMap, currentState(game), 'p1', null).has('s2')).toBe(false);
    expect(warningKinds(game, toOpponent)).toEqual(['travelOnOpponent']);
  });

  it('the turn after a trip only interactions: no moves, not even with an extra action', () => {
    let game = withItem(newGame({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 1, 'Doppia azione')] }), 'flying-nimbus');
    game = act(game, nimbusTo('n1'));
    expect(currentState(game).players.p1.noMovesNext).toBe(true);
    // The same turn is as before: a move is still allowed.
    expect(warningKinds(game, { type: 'move', to: 'sh1' })).not.toContain('noMovesTurn');
    game = act(game, { type: 'endTurn' });
    game = act(game, { type: 'endTurn' });
    expect(currentState(game).currentPlayer).toBe('p1');
    expect(warningKinds(game, { type: 'move', to: 'sh1' })).toContain('noMovesTurn');
    expect(warningKinds(game, { type: 'interact', nodeId: 'n1' })).not.toContain('noMovesTurn');
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(warningKinds(game, { type: 'move', to: 'sh1' })).toContain('noMovesTurn');
    // And the turn after that, the pawn moves again.
    game = act(act(game, { type: 'endTurn' }), { type: 'endTurn' });
    expect(warningKinds(game, { type: 'move', to: 'sh1' })).not.toContain('noMovesTurn');
  });

  it('a trip in the turn after a trip warns too', () => {
    let game = withItem(withItem(newGame(), 'flying-nimbus'), 'flying-nimbus');
    game = act(game, nimbusTo('n1'));
    game = act(act(game, { type: 'endTurn' }), { type: 'endTurn' });
    expect(warningKinds(game, nimbusTo('sh1'))).toContain('noMovesTurn');
  });
});

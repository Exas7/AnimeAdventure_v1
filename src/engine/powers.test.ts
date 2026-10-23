import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings } from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

const endTurn: GameAction = { type: 'endTurn' };

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

describe('powers (spec 001, criteria 1-8)', () => {
  it('C1: "+250 coins every 2 turns" pays at the end of every second turn of the owner', () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.coinsEveryNTurns(250, 2)] }));
    const coinsAfterOwnTurns: number[] = [];
    for (let ownTurn = 1; ownTurn <= 4; ownTurn++) {
      game = act(game, endTurn); // G1 ends their turn
      coinsAfterOwnTurns.push(currentState(game).players.p1.coins);
      game = act(game, endTurn); // G2 ends their turn
    }
    expect(coinsAfterOwnTurns).toEqual([0, 250, 250, 500]);
    expect(currentState(game).players.p2.coins).toBe(0);
  });

  it("C2: \"+200 coins per interaction\" pays on the owner's interactions only", () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.coinsPerInteraction(200)] }));
    game = act(game, { type: 'interact', nodeId: 'c1' });
    expect(currentState(game).players.p1.coins).toBe(200);

    game = play(game, endTurn, { type: 'interact', nodeId: 'c4' }); // G2 interacts
    expect(currentState(game).players.p1.coins).toBe(200);

    game = play(game, endTurn, { type: 'interact', nodeId: 'c2' });
    expect(currentState(game).players.p1.coins).toBe(400);
  });

  it('C3: extra starting coins are included in the starting balance', () => {
    const game = createGame(
      testSetup({ startingCoins: 1000, p1Powers: [powerCatalog.extraStartingCoins(500)] }),
    );
    expect(currentState(game).players.p1.coins).toBe(1500);
    expect(currentState(game).players.p2.coins).toBe(1000);
  });

  it("C4: fixed double move gives 4 actions on every owner's turn, 2 to the opponent", () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.fixedExtraActions(2)] }));
    expect(currentState(game).actions.available).toBe(4);
    game = act(game, endTurn);
    expect(currentState(game).actions.available).toBe(2);
    game = act(game, endTurn);
    expect(currentState(game).actions.available).toBe(4);
  });

  it('C5: double move on demand gives 4 actions for that turn only and uses one use', () => {
    let game = createGame(
      testSetup({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 3, 'Doppio movimento')] }),
    );
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(currentState(game).actions.available).toBe(4);
    expect(currentState(game).players.p1.powers[0]?.usesLeft).toBe(2);

    game = play(game, endTurn, endTurn);
    expect(currentState(game).currentPlayer).toBe('p1');
    expect(currentState(game).actions.available).toBe(2);
  });

  it('«Doppia azione» gives 2 actions and 1 interaction more: a third interaction is warned (spec 067, criterion 1)', () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.doubleActionOnDemand(2)] }));
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(currentState(game).actions).toMatchObject({ available: 4, interactionsAvailable: 2 });
    expect(currentState(game).notifications.at(-1)?.text).toBe('G1 · Doppia azione: +2 azioni e +1 interazione');

    // Interacting where the pawn stands again only reopens the scene: three different cells.
    game = play(game, { type: 'interact', nodeId: 's1' }, { type: 'interact', nodeId: 'c1' });
    expect(lastWarnings(game)).toEqual([]);
    game = act(game, { type: 'interact', nodeId: 'c2' });
    expect(lastWarnings(game).map((warning) => warning.kind)).toContain('noInteractionsLeft');

    game = play(game, endTurn, endTurn);
    expect(currentState(game).actions).toMatchObject({ available: 2, interactionsAvailable: 1 });
  });

  it('C6: a skipped turn is lost entirely and shows in the log', () => {
    let game = createGame(
      testSetup({
        p1Powers: [powerCatalog.skipOpponentTurn(1)],
        p2Powers: [
          powerCatalog.coinsAtTurnEnd(100),
          powerCatalog.coinsEveryNTurns(50, 1),
          powerCatalog.reminder('Tocca a G2', { type: 'turnStart' }),
        ],
      }),
    );
    game = play(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' }, endTurn);

    const state = currentState(game);
    expect(state.currentPlayer).toBe('p1');
    expect(state.turn).toBe(3);
    expect(state.players.p2.coins).toBe(0);
    expect(state.players.p2.turnsPlayed).toBe(0);
    expect(state.players.p2.turnsToSkip).toBe(0);
    expect(state.notifications.some((n) => n.text.includes('Tocca a G2'))).toBe(false);

    const lastLine = gameLog(game).at(-1);
    expect(lastLine?.details).toContain('Turno 2: G2 salta il turno');

    // The following turn of G2 is played normally.
    game = act(game, endTurn);
    expect(currentState(game).currentPlayer).toBe('p2');
    expect(currentState(game).turn).toBe(4);
  });

  it('C7: a reminder produces a notification and does not change coins', () => {
    let game = createGame(
      testSetup({
        startingCoins: 300,
        p1Powers: [
          powerCatalog.reminder('Puoi ritentare una sfida', { type: 'manual', uses: 1 }),
        ],
      }),
    );
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    const state = currentState(game);
    expect(state.notifications.map((n) => n.text)).toEqual([
      'G1 · Promemoria: Puoi ritentare una sfida',
    ]);
    expect(state.players.p1.coins).toBe(300);
    expect(state.players.p2.coins).toBe(300);
  });

  it('C8: the same catalog character can be a starter with different powers in two games', () => {
    const first = createGame(testSetup({ p1Powers: [powerCatalog.coinsPerInteraction(200)] }));
    const second = createGame(testSetup({ p1Powers: [powerCatalog.coinsEveryNTurns(250, 2)] }));
    const p1First = currentState(first).players.p1;
    const p1Second = currentState(second).players.p1;

    expect(p1First.starterId).toBe('hero-1');
    expect(p1Second.starterId).toBe('hero-1');
    expect(p1First.powers.map((p) => p.definition.trigger.type)).toEqual(['interaction']);
    expect(p1Second.powers.map((p) => p.definition.trigger.type)).toEqual(['everyNTurns']);
  });
});

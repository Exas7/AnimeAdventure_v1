import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { isRepeatInteraction, turnRuleWarnings } from './rules';
import { testSetup } from './testMap';
import type { Game, GameAction, GameSetup } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

/** G1 earns 200 coins at every interaction and stands on Personaggio A (c1). */
function onC1(): Game {
  const game = createGame(
    testSetup({ startingCoins: 0, p1Powers: [powerCatalog.coinsPerInteraction(200)] }),
  );
  return act(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
}

const interactC1: GameAction = { type: 'interact', nodeId: 'c1' };

describe('reopening the scene without a new interaction (spec 020, criterion 3)', () => {
  it('the first opening counts; reopening counts nothing, fires no power and warns nothing', () => {
    const first = act(onC1(), interactC1);
    expect(currentState(first).actions).toMatchObject({ used: 1, interactionsUsed: 1 });
    expect(currentState(first).players.p1.coins).toBe(200);
    expect(isRepeatInteraction(currentState(first), 'c1')).toBe(true);

    // The interactions of the turn are over, yet reopening asks for nothing.
    expect(turnRuleWarnings(currentState(first), interactC1, first)).toEqual([]);
    const again = act(first, interactC1);
    expect(currentState(again).actions).toEqual(currentState(first).actions);
    expect(currentState(again).players.p1.coins).toBe(200);
    expect(lastWarnings(again)).toEqual([]);
    expect(gameLog(again).at(-1)?.text).toBe('G1 riapre la scena di Personaggio A');
  });

  it('after the pawn leaves the cell, or in the next turn, it counts again', () => {
    const first = act(onC1(), interactC1);

    const backAgain = play(first, { type: 'move', to: 'n1' }, { type: 'move', to: 'c1' });
    expect(isRepeatInteraction(currentState(backAgain), 'c1')).toBe(false);
    expect(currentState(act(backAgain, interactC1)).actions.interactionsUsed).toBe(2);

    const nextTurn = play(first, { type: 'endTurn' }, { type: 'endTurn' });
    expect(currentState(nextTurn).players.p1.position).toBe('c1');
    const interacted = act(nextTurn, interactC1);
    expect(currentState(interacted).actions.interactionsUsed).toBe(1);
    expect(currentState(interacted).players.p1.coins).toBe(400);
  });

  it('a correction that moves the pawn away resets it; moving the other pawn does not', () => {
    const first = act(onC1(), interactC1);
    const otherMoved = act(first, { type: 'placePawn', player: 'p2', nodeId: 'n2' });
    expect(isRepeatInteraction(currentState(otherMoved), 'c1')).toBe(true);
    const corrected = play(
      first,
      { type: 'placePawn', player: 'p1', nodeId: 'n1' },
      { type: 'placePawn', player: 'p1', nodeId: 'c1' },
    );
    expect(isRepeatInteraction(currentState(corrected), 'c1')).toBe(false);
  });

  it('undoing the interaction makes the next opening count again', () => {
    const undone = undo(act(onC1(), interactC1));
    expect(isRepeatInteraction(currentState(undone), 'c1')).toBe(false);
    expect(currentState(act(undone, interactC1)).actions.interactionsUsed).toBe(1);
  });

  it('an interaction with a cell where the pawn is not is never a reopening', () => {
    const elsewhere = act(onC1(), { type: 'interact', nodeId: 'c2' });
    expect(isRepeatInteraction(currentState(elsewhere), 'c2')).toBe(false);
  });
});

describe('"Assegna" (spec 020, criterion 4)', () => {
  // e8 (c1 - n3) is locked and opens with c1 (D-027).
  function keyedSetup(): GameSetup {
    const setup = testSetup();
    const edges = setup.map.edges.map((edge) =>
      edge.id === 'e8' ? { ...edge, unlockNodeId: 'c1' } : edge,
    );
    return { ...setup, map: { ...setup.map, edges } };
  }

  it('puts the character in the team and conquers the cell, in one undoable action', () => {
    const start = createGame(keyedSetup());
    const game = act(start, { type: 'assign', nodeId: 'c1', player: 'p1' });
    const state = currentState(game);
    expect(state.players.p1.team).toContain('char-a');
    expect(state.conquests.c1).toBe('p1');
    expect(state.edgeLocks.e8).toEqual({ p1: false, p2: true });
    expect(game.history).toHaveLength(start.history.length + 1);
    expect(gameLog(game).at(-1)?.text).toBe('G1 riceve Personaggio A e conquista la sua casella');
    expect(lastWarnings(game)).toEqual([]);

    expect(currentState(undo(game))).toEqual(currentState(start));
  });

  it('a second time it warns, and the character is not in the team twice', () => {
    const twice = play(
      createGame(testSetup()),
      { type: 'assign', nodeId: 'c1', player: 'p1' },
      { type: 'assign', nodeId: 'c1', player: 'p1' },
    );
    expect(currentState(twice).players.p1.team.filter((id) => id === 'char-a')).toHaveLength(1);
    expect(lastWarnings(twice).map((warning) => warning.kind)).toEqual([
      'nodeAlreadyConquered',
      'characterInTeam',
    ]);
  });

  it('a character in the other team is assigned anyway, with a warning', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'addCharacter', player: 'p2', characterId: 'char-a' },
      { type: 'assign', nodeId: 'c1', player: 'p1' },
    );
    expect(currentState(game).players.p1.team).toContain('char-a');
    expect(lastWarnings(game)).toEqual([
      { kind: 'characterInTeam', message: 'Personaggio A è anche nella squadra di G2' },
    ]);
  });

  it('a cell without a character cannot be assigned', () => {
    expect(() => act(createGame(testSetup()), { type: 'assign', nodeId: 'n1', player: 'p1' })).toThrow(
      EngineError,
    );
  });
});

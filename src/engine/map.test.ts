import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { turnRuleWarnings } from './rules';
import { testSetup } from './testMap';
import type { Game, GameAction, GameSetup } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

describe('map and turns (spec 001, criteria 14-15)', () => {
  it('C14: moving a pawn to a cell that is not connected works, counts as an action and warns', () => {
    const start = createGame(testSetup());
    const move: GameAction = { type: 'move', to: 's2' };
    const expected = [
      {
        kind: 'notAdjacent',
        message: 'Mossa non adiacente: nessun percorso aperto per G1 porta a casella #s2',
      },
    ];
    expect(turnRuleWarnings(currentState(start), move, start)).toEqual(expected);

    const game = act(start, move);
    expect(currentState(game).players.p1.position).toBe('s2');
    expect(currentState(game).actions.used).toBe(1);
    expect(lastWarnings(game)).toEqual(expected);
  });

  it('C15: a path can be unlocked for one player only, then for the other', () => {
    let game = createGame(testSetup());
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: true, p2: true });

    game = act(game, { type: 'setEdgeLock', edgeId: 'e8', players: 'p1', locked: false });
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: false, p2: true });

    game = act(game, { type: 'setEdgeLock', edgeId: 'e8', players: 'p2', locked: false });
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: false, p2: false });
  });
});

describe('paths opened by conquering a cell (spec 016, D-027)', () => {
  // e8 opens with c1; e9 is locked with no cell; e10 opens with c2.
  function keyedSetup(): GameSetup {
    const setup = testSetup();
    const edges = setup.map.edges.map((edge) => {
      switch (edge.id) {
        case 'e8':
          return { ...edge, unlockNodeId: 'c1' };
        case 'e9':
          return { ...edge, locked: true };
        case 'e10':
          return { ...edge, locked: true, unlockNodeId: 'c2' };
        default:
          return edge;
      }
    });
    return { ...setup, map: { ...setup.map, edges } };
  }

  function lastEvents(game: Game): string[] {
    return game.history[game.history.length - 1]?.events ?? [];
  }

  it('conquering the cell opens its paths for the conqueror only', () => {
    const game = act(createGame(keyedSetup()), {
      type: 'setConquest',
      nodeId: 'c1',
      player: 'p1',
    });
    const locks = currentState(game).edgeLocks;
    expect(locks.e8).toEqual({ p1: false, p2: true });
    expect(locks.e9).toEqual({ p1: true, p2: true });
    expect(locks.e10).toEqual({ p1: true, p2: true });
    expect(lastEvents(game)).toEqual(['Percorso Personaggio A – casella #3 aperto per G1']);
  });

  it('making the cell free again closes its paths for the previous conqueror', () => {
    const game = play(
      createGame(keyedSetup()),
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'setConquest', nodeId: 'c1', player: null },
    );
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: true, p2: true });
    expect(lastEvents(game)).toEqual(['Percorso Personaggio A – casella #3 richiuso per G1']);
  });

  it('passing the conquest to the other player moves the opening to them', () => {
    const game = play(
      createGame(keyedSetup()),
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'setConquest', nodeId: 'c1', player: 'p2' },
    );
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: true, p2: false });
  });

  it('conquering again for the same player changes nothing', () => {
    const game = play(
      createGame(keyedSetup()),
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
    );
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: false, p2: true });
    expect(lastEvents(game)).toEqual([]);
  });

  it('removing the conquest closes the path even if the host had opened it by hand', () => {
    const game = play(
      createGame(keyedSetup()),
      { type: 'setEdgeLock', edgeId: 'e8', players: 'p1', locked: false },
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'setConquest', nodeId: 'c1', player: null },
    );
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: true, p2: true });
  });

  it('a path that is open at the start is never closed by a conquest', () => {
    const setup = keyedSetup();
    const edges = setup.map.edges.map((edge) =>
      edge.id === 'e11' ? { ...edge, unlockNodeId: 'c1' } : edge,
    );
    const game = play(
      createGame({ ...setup, map: { ...setup.map, edges } }),
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'setConquest', nodeId: 'c1', player: null },
    );
    expect(currentState(game).edgeLocks.e11).toEqual({ p1: false, p2: false });
  });

  it('undo takes back the conquest and the opening together', () => {
    const start = createGame(keyedSetup());
    const game = undo(act(start, { type: 'setConquest', nodeId: 'c1', player: 'p1' }));
    expect(currentState(game).conquests).toEqual({});
    expect(currentState(game).edgeLocks.e8).toEqual({ p1: true, p2: true });
  });
});

describe('turn counter and manual corrections', () => {
  it('counts actions and interactions without ever blocking', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'move', to: 'n1' },
      { type: 'move', to: 'c1' },
      { type: 'interact', nodeId: 'c1' },
    );
    expect(currentState(game).actions).toEqual({
      used: 3,
      available: 2,
      interactionsUsed: 1,
      interactionsAvailable: 1,
    });
    // The interaction after two moves happens, with a warning (D-013).
    expect(lastWarnings(game).map((warning) => warning.kind)).toEqual(['noActionsLeft']);
  });

  it('end of turn passes the hand, advances the counter and resets the actions', () => {
    const game = play(createGame(testSetup()), { type: 'move', to: 'n1' }, { type: 'endTurn' });
    const state = currentState(game);
    expect(state.currentPlayer).toBe('p2');
    expect(state.turn).toBe(2);
    expect(state.actions.used).toBe(0);
    expect(state.players.p1.turnsPlayed).toBe(1);
  });

  it('manual corrections change values without counting as actions', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'placePawn', player: 'p2', nodeId: 'n3' },
      { type: 'setCoins', player: 'p2', coins: 750 },
      { type: 'setTurn', turn: 9 },
      { type: 'setTurnsToSkip', player: 'p2', turns: 2 },
      { type: 'setActions', actions: { available: 5 } },
      { type: 'setCurrentPlayer', player: 'p2' },
    );
    const state = currentState(game);
    expect(state.players.p2.position).toBe('n3');
    expect(state.players.p2.coins).toBe(750);
    expect(state.turn).toBe(9);
    expect(state.players.p2.turnsToSkip).toBe(2);
    expect(state.actions).toEqual({
      used: 0,
      available: 5,
      interactionsUsed: 0,
      interactionsAvailable: 1,
    });
    expect(state.currentPlayer).toBe('p2');
  });

  it('a conquered cell can be made free again', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'setConquest', nodeId: 'c2', player: 'p2' },
      { type: 'setConquest', nodeId: 'c2', player: null },
    );
    expect(currentState(game).conquests).toEqual({});
  });

  it('rejects references to things that do not exist', () => {
    const game = createGame(testSetup());
    expect(() => act(game, { type: 'move', to: 'nowhere' })).toThrow(EngineError);
    expect(() => act(game, { type: 'usePower', player: 'p1', powerId: 'p1-9' })).toThrow(
      EngineError,
    );
  });
});

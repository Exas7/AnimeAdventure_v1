import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { isAdjacent, turnRuleWarnings } from './rules';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

function kinds(game: Game): string[] {
  return lastWarnings(game).map((warning) => warning.kind);
}

describe('turn rules (spec 001, criteria 21-23, D-013)', () => {
  it('C21: a move along a path closed for the mover warns; along an open path it does not', () => {
    // n1 -> c1 is open; c1 -> n3 (e8) starts closed for both players.
    const atC1 = play(createGame(testSetup()), { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect(kinds(act(atC1, { type: 'move', to: 'n1' }))).toEqual([]);
    expect(kinds(act(atC1, { type: 'move', to: 'n3' }))).toEqual(['notAdjacent']);

    const unlocked = act(atC1, { type: 'setEdgeLock', edgeId: 'e8', players: 'p1', locked: false });
    expect(kinds(act(unlocked, { type: 'move', to: 'n3' }))).toEqual([]);
    expect(isAdjacent(unlocked.map, currentState(unlocked), 'p2', 'c1', 'n3')).toBe(false);
  });

  it('C22: actions past the counter warn, and so does a second interaction', () => {
    const twoMoves = play(
      createGame(testSetup()),
      { type: 'move', to: 'n1' },
      { type: 'move', to: 'c1' },
    );
    expect(lastWarnings(twoMoves)).toEqual([]);

    const interaction = act(twoMoves, { type: 'interact', nodeId: 'c1' });
    expect(lastWarnings(interaction)).toEqual([
      { kind: 'noActionsLeft', message: 'G1 ha già usato tutte le azioni del turno' },
    ]);

    // On another cell: interacting again where the pawn stands only reopens the scene (spec 020).
    const secondInteraction = play(
      createGame(testSetup()),
      { type: 'interact', nodeId: 's1' },
      { type: 'interact', nodeId: 'c1' },
    );
    expect(lastWarnings(secondInteraction)).toEqual([
      { kind: 'noInteractionsLeft', message: 'G1 ha già usato le interazioni del turno' },
    ]);
  });

  it('C23: each kind of warning is given once per turn and comes back the next turn', () => {
    let game = act(createGame(testSetup()), { type: 'move', to: 's2' });
    expect(kinds(game)).toEqual(['notAdjacent']);

    game = act(game, { type: 'move', to: 'c4' });
    expect(kinds(game)).toEqual([]);
    // Another non-adjacent move is not warned again; only the new kind is.
    const check = turnRuleWarnings(currentState(game), { type: 'move', to: 'n2' }, game);
    expect(check.map((warning) => warning.kind)).toEqual(['noActionsLeft']);

    // Third action: a new kind of warning is still given.
    game = act(game, { type: 'move', to: 'n5' });
    expect(kinds(game)).toEqual(['noActionsLeft']);

    // Next turn of G2, then G1 again: warnings start over.
    game = play(game, { type: 'endTurn' }, { type: 'endTurn' });
    expect(currentState(game).acknowledgedThisTurn).toEqual([]);
    expect(kinds(act(game, { type: 'move', to: 's1' }))).toEqual(['notAdjacent']);
  });

  it('D-014: interacting with a conquered cell is warned before acting, once per turn', () => {
    const conquered = play(
      createGame(testSetup()),
      { type: 'setConquest', nodeId: 'c1', player: 'p2' },
      { type: 'setActions', actions: { interactionsAvailable: 2 } },
    );
    const interact: GameAction = { type: 'interact', nodeId: 'c1' };
    expect(turnRuleWarnings(currentState(conquered), interact, conquered)).toEqual([
      { kind: 'nodeAlreadyConquered', message: 'G2 ha già conquistato Personaggio A' },
    ]);

    const first = act(conquered, interact);
    expect(kinds(first)).toEqual(['nodeAlreadyConquered']);
    expect(turnRuleWarnings(currentState(first), interact, first)).toEqual([]);
    expect(kinds(act(first, interact))).toEqual([]);
  });

  it('undo also restores which warnings were already given', () => {
    const before = createGame(testSetup());
    const after = act(before, { type: 'move', to: 's2' });
    expect(currentState(after).acknowledgedThisTurn).toEqual(['notAdjacent']);
    expect(currentState(undo(after)).acknowledgedThisTurn).toEqual([]);
  });

  it('the end of a turn is checked only with actions left (spec 021, criterion 1, D-033)', () => {
    const game = createGame(testSetup());
    expect(turnRuleWarnings(currentState(game), { type: 'endTurn' }, game)).toEqual([
      { kind: 'actionsLeft', message: 'G1 ha ancora 2 azioni nel turno' },
    ]);
    const oneLeft = act(game, { type: 'move', to: 'n1' });
    expect(turnRuleWarnings(currentState(oneLeft), { type: 'endTurn' }, oneLeft)).toEqual([
      { kind: 'actionsLeft', message: 'G1 ha ancora 1 azione nel turno' },
    ]);
    const noneLeft = act(oneLeft, { type: 'move', to: 'c1' });
    expect(turnRuleWarnings(currentState(noneLeft), { type: 'endTurn' }, noneLeft)).toEqual([]);
  });

  it('a correction of a pawn is not checked by the game: the director asks (D-033)', () => {
    const game = createGame(testSetup());
    expect(
      turnRuleWarnings(currentState(game), { type: 'placePawn', player: 'p1', nodeId: 's2' }, game),
    ).toEqual([]);
  });

  it('the end of a turn with actions left still ends it at the second click', () => {
    const game = createGame(testSetup());
    const ended = act(game, { type: 'endTurn' });
    expect(currentState(ended).currentPlayer).toBe('p2');
    expect(currentState(ended).acknowledgedThisTurn).toEqual([]);
    expect(currentState(undo(ended)).acknowledgedThisTurn).toEqual([]);
  });
});

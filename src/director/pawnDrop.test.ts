import { describe, expect, it } from 'vitest';
import { createGame, currentState, testSetup } from '../engine';
import { pawnDropAction, pawnDropWarnings } from './pawnDrop';

describe('dropping a pawn (spec 016, D-026)', () => {
  // G1 is the current player, on s1; G2 is on s2.
  const state = currentState(createGame(testSetup()));

  it("the current player's pawn makes a move", () => {
    expect(pawnDropAction(state, 'p1', 'n1')).toEqual({ type: 'move', to: 'n1' });
  });

  it('the other pawn is placed as a correction, counting no action', () => {
    expect(pawnDropAction(state, 'p2', 'n4')).toEqual({
      type: 'placePawn',
      player: 'p2',
      nodeId: 'n4',
    });
  });

  it('dropped on its own cell, nothing happens', () => {
    expect(pawnDropAction(state, 'p1', 's1')).toBeNull();
    expect(pawnDropAction(state, 'p2', 's2')).toBeNull();
  });
});

describe('the other pawn asks for a second drop (spec 021, criterion 2, D-033)', () => {
  const state = currentState(createGame(testSetup()));

  it("the current player's pawn: no warning here, the turn rules decide", () => {
    expect(pawnDropWarnings(state, 'p1')).toEqual([]);
  });

  it('the other pawn: a warning at every drop, never recorded in the game', () => {
    expect(pawnDropWarnings(state, 'p2')).toEqual([
      {
        kind: 'otherPlayerPawn',
        message: 'Non è il turno di G2: la pedina si sposta come correzione, senza contare azioni',
      },
    ]);
    expect(state.acknowledgedThisTurn).toEqual([]);
  });
});

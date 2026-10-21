import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, testSetup } from '../engine';
import { showdownDue } from './showdown';

describe('automatic showdown (spec 018, D-029)', () => {
  it('is due when both pawns stand on the same cell', () => {
    const game = act(createGame(testSetup()), { type: 'placePawn', player: 'p2', nodeId: 's1' });
    expect(showdownDue(currentState(game))).toBe(true);
  });

  it('is not due with the pawns on different cells', () => {
    expect(showdownDue(currentState(createGame(testSetup())))).toBe(false);
  });
});

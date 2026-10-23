import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, testMap, testSetup, type Game } from '../engine';
import { activeTravel, copiesOf, travelCells, type TravelChoice } from './travel';

function withNimbus(): Game {
  return act(createGame(testSetup()), { type: 'addToInventory', player: 'p1', itemId: 'flying-nimbus' });
}

const nimbus: TravelChoice = { player: 'p1', itemId: 'flying-nimbus', turn: 1, copies: 1 };

describe('choosing the cell of a travel item (spec 047, 2.2)', () => {
  it('highlights the cells the pawn can reach, and nothing without a choice', () => {
    const game = withNimbus();
    const state = currentState(game);
    expect(travelCells(game, state, null)).toBeNull();
    const cells = travelCells(game, state, { ...nimbus, turn: state.turn });
    // Not its own cell, nor the opponent's (spec 086).
    expect(cells).toHaveLength(testMap.nodes.length - 2);
    expect(cells).not.toContain('s1');
  });

  it('goes off at the end of the turn and once the item is used', () => {
    let game = withNimbus();
    const choice = { ...nimbus, turn: currentState(game).turn };
    expect(activeTravel(currentState(game), choice)).toEqual(choice);

    const used = act(game, { type: 'useItem', player: 'p1', itemId: 'flying-nimbus', to: 'n1' });
    expect(activeTravel(currentState(used), choice)).toBeNull();

    game = act(game, { type: 'endTurn' });
    expect(activeTravel(currentState(game), choice)).toBeNull();
    expect(travelCells(game, currentState(game), choice)).toBeNull();
  });

  it('goes off once a copy is used, even with more copies left', () => {
    let game = act(withNimbus(), { type: 'addToInventory', player: 'p1', itemId: 'flying-nimbus' });
    const state = currentState(game);
    const choice = { ...nimbus, turn: state.turn, copies: copiesOf(state, 'p1', 'flying-nimbus') };
    expect(choice.copies).toBe(2);
    game = act(game, { type: 'useItem', player: 'p1', itemId: 'flying-nimbus', to: 'n1' });
    expect(activeTravel(currentState(game), choice)).toBeNull();
  });
});

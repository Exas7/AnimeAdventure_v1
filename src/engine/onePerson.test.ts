import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings } from './game';
import { testSetup } from './testMap';

/** The test game, with a second form of Eroe Due, the starter of G2. */
function setup() {
  const base = testSetup();
  return {
    ...base,
    catalog: [
      ...base.catalog.map((character) =>
        character.id === 'hero-2' ? { ...character, person: 'Eroe Due' } : character,
      ),
      { id: 'hero-2-ssj', name: 'Eroe Due SSJ', person: 'Eroe Due' },
    ],
  };
}

describe('one person in one place, by hand: warnings, never blocks (spec 039, criterion 5)', () => {
  it('adding to a team a form of a person already in a team warns, and the character joins', () => {
    const game = act(createGame(setup()), { type: 'addCharacter', player: 'p1', characterId: 'hero-2-ssj' });
    expect(lastWarnings(game)).toContainEqual({
      kind: 'characterAlreadyPlaced',
      message: "Eroe Due SSJ: c'è già Eroe Due nella squadra di G2",
    });
    expect(currentState(game).players.p1.team).toContain('hero-2-ssj');
  });

  it('putting it in a cell warns the same way, and it is placed', () => {
    const game = act(createGame(setup()), {
      type: 'setCellContent',
      nodeId: 'c1',
      content: { characterId: 'hero-2-ssj' },
    });
    expect(lastWarnings(game).map((warning) => warning.message)).toEqual([
      "Eroe Due SSJ: c'è già Eroe Due nella squadra di G2",
    ]);
    expect(currentState(game).cells.c1?.characterId).toBe('hero-2-ssj');
  });

  it('a character won from a conquered cell is in the team, not on the cell', () => {
    let game = act(createGame(setup()), { type: 'assign', nodeId: 'c1', player: 'p2' });
    game = act(game, { type: 'addCharacter', player: 'p1', characterId: 'char-a' });
    expect(lastWarnings(game).map((warning) => warning.message)).toContain(
      'Personaggio A è già nella squadra di G2',
    );
  });

  it('the same character in a cell and added by hand to a team warns too', () => {
    const game = act(createGame(setup()), { type: 'addCharacter', player: 'p1', characterId: 'char-a' });
    expect(lastWarnings(game).map((warning) => warning.message)).toEqual(['Personaggio A è già sulla casella #c1']);
  });
});

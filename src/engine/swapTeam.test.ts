import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, undo } from './game';
import { gameLog } from './log';
import { testSetup } from './testMap';

const withTeam = () => {
  let game = createGame(testSetup());
  game = act(game, { type: 'addCharacter', player: 'p1', characterId: 'char-a' });
  return act(game, { type: 'addCharacter', player: 'p1', characterId: 'char-b' });
};
const team = (game: ReturnType<typeof createGame>) => currentState(game).players.p1.team;

describe('the order of the team in the showdown (spec 081)', () => {
  it('two places swap, and one undo gives them back (criteria 1 and 3)', () => {
    const game = withTeam();
    const before = [...team(game)];
    const swapped = act(game, { type: 'swapTeam', player: 'p1', a: 0, b: 2 });
    expect(team(swapped)).toEqual([before[2], before[1], before[0]]);
    expect(team(undo(swapped))).toEqual(before);
  });

  it('the log says who swapped with whom', () => {
    const game = act(withTeam(), { type: 'swapTeam', player: 'p1', a: 1, b: 2 });
    expect(gameLog(game).at(-1)?.text).toMatch(/scambia .* e .* nella squadra/);
  });

  it('places that do not exist, or the same place twice, are refused (criterion 4)', () => {
    const game = withTeam();
    expect(() => act(game, { type: 'swapTeam', player: 'p1', a: 0, b: 7 })).toThrow();
    expect(() => act(game, { type: 'swapTeam', player: 'p1', a: 1, b: 1 })).toThrow();
    expect(() => act(game, { type: 'swapTeam', player: 'p1', a: -1, b: 1 })).toThrow();
  });
});

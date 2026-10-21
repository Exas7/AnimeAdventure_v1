import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { gameLog } from './log';
import { testSetup } from './testMap';
import type { GameAction } from './types';

const update = (changes: { from: string; to: string }[]): GameAction => ({
  type: 'transformCharacters',
  player: 'p1',
  changes,
});

describe('"Aggiorna la squadra" after a simulated fight (spec 037, 2.4 and criterion 8)', () => {
  it('the new form takes the place of the old one, the starter included, and "↺" undoes it', () => {
    const start = act(createGame(testSetup()), { type: 'addCharacter', player: 'p1', characterId: 'char-a' });
    const game = act(start, update([
      { from: 'hero-1', to: 'char-b' },
      { from: 'char-a', to: 'char-c' },
    ]));
    const p1 = currentState(game).players.p1;
    expect(p1.team).toEqual(['char-b', 'char-c']);
    expect(p1.starterId).toBe('char-b');
    expect(gameLog(game).at(-1)?.text).toBe(
      'Squadra di G1 aggiornata: Eroe Uno → Personaggio B, Personaggio A → Personaggio C',
    );
    expect(currentState(undo(game)).players.p1.team).toEqual(['hero-1', 'char-a']);
    expect(currentState(undo(game)).players.p1.starterId).toBe('hero-1');
  });

  it('a form already in a team only warns (D-008)', () => {
    const start = act(createGame(testSetup()), { type: 'addCharacter', player: 'p2', characterId: 'char-b' });
    const game = act(start, update([{ from: 'hero-1', to: 'char-b' }]));
    expect(currentState(game).players.p1.team).toEqual(['char-b']);
    expect(lastWarnings(game).map((warning) => warning.kind)).toContain('characterInTeam');
  });

  it('a character not in the team cannot transform', () => {
    expect(() => act(createGame(testSetup()), update([{ from: 'char-a', to: 'char-b' }]))).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { createGame, parseGame, serializeGame, testSetup } from '../engine';
import { isArbitrated, markArbitrated, secondPlayerName } from './gameKind';

describe('the game remembers its kind (spec 076, criteria 1-3)', () => {
  it('a PvP / PvIA game saved and read again is still one', () => {
    const game = markArbitrated(createGame(testSetup()), null);
    expect(isArbitrated(parseGame(serializeGame(game)))).toBe(true);
  });

  it('a game of the director, and a file without the new field, open in the director', () => {
    const game = createGame(testSetup());
    expect(isArbitrated(game)).toBe(false);
    expect(isArbitrated(parseGame(serializeGame(game)))).toBe(false);
  });

  it('a game against the AI saved before spec 076 counts as PvP / PvIA', () => {
    const game = { ...createGame(testSetup()), opponent: { player: 'p2' as const, level: 'normal' as const } };
    expect(game.arbitrated).toBeUndefined();
    expect(isArbitrated(game)).toBe(true);
  });

  it('a new PvP / PvIA game keeps the AI and its level when there is one', () => {
    const game = createGame(testSetup());
    const against = markArbitrated(game, 'hard');
    expect(against.arbitrated).toBe(true);
    expect(against.opponent).toEqual({ player: 'p2', level: 'hard' });
    const between = markArbitrated(game, null);
    expect(between.arbitrated).toBe(true);
    expect(between.opponent).toBeUndefined();
  });

  it('a new game of the director has neither the mark nor the AI', () => {
    const game = createGame(testSetup());
    expect(game.arbitrated).toBeUndefined();
    expect(game.opponent).toBeUndefined();
  });
});

describe("G2's name and the AI (spec 053, 2.1)", () => {
  it('becomes «IA» against the AI and «G2» again without it', () => {
    expect(secondPlayerName('G2', 'easy')).toBe('IA');
    expect(secondPlayerName('IA', null)).toBe('G2');
  });

  it('keeps a name given by hand', () => {
    expect(secondPlayerName('Vegeta', 'normal')).toBe('Vegeta');
    expect(secondPlayerName('Vegeta', null)).toBe('Vegeta');
  });
});

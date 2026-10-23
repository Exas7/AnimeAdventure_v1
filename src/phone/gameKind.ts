import type { AiLevel, Game } from '../engine';

/** The kind of game chosen in «Nuova partita» on the PC (spec 076, 2.1; D-101). */
export type GameKind = 'director' | 'arbitrated';

/**
 * PvP / PvIA: the app is the arbiter (spec 076, 2.3). A game against the AI
 * saved before spec 076 has no mark, and is one too.
 */
export function isArbitrated(game: Game): boolean {
  return game.arbitrated === true || game.opponent !== undefined;
}

/** A new PvP / PvIA game remembers it, and the AI at its level when there is one (D-086, D-101). */
export function markArbitrated(game: Game, aiLevel: AiLevel | null): Game {
  return aiLevel
    ? { ...game, arbitrated: true, opponent: { player: 'p2', level: aiLevel } }
    : { ...game, arbitrated: true };
}

/** G2 is called «IA» against the AI and «G2» again without it; a name given by hand stays (spec 053, 2.1). */
export function secondPlayerName(name: string, aiLevel: AiLevel | null): string {
  if (aiLevel) {
    return name === 'G2' ? 'IA' : name;
  }
  return name === 'IA' ? 'G2' : name;
}

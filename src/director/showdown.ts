import type { GameState } from '../engine';

/**
 * Both pawns on the same cell: at the end of a turn the showdown screen
 * opens by itself (format rule 7, D-029).
 */
export function showdownDue(state: GameState): boolean {
  return state.players.p1.position === state.players.p2.position;
}

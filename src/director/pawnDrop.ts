import type { GameAction, GameState, PlayerId, Warning } from '../engine';

/**
 * What dropping a pawn on a cell does (D-026): the current player's pawn
 * makes a move, with the turn rules of D-013; the other pawn is placed as a
 * correction, counting no action, after a second drop (D-033). Dropped
 * where it already stands: nothing.
 */
export function pawnDropAction(
  state: GameState,
  player: PlayerId,
  nodeId: string,
): GameAction | null {
  if (state.players[player].position === nodeId) {
    return null;
  }
  return player === state.currentPlayer
    ? { type: 'move', to: nodeId }
    : { type: 'placePawn', player, nodeId };
}

/**
 * The warning that asks for a second drop of the other player's pawn
 * (D-033). Given at every drop, not once per turn: the game does not record it.
 */
export function pawnDropWarnings(state: GameState, player: PlayerId): Warning[] {
  if (player === state.currentPlayer) {
    return [];
  }
  const { name } = state.players[player];
  return [
    {
      kind: 'otherPlayerPawn',
      message: `Non è il turno di ${name}: la pedina si sposta come correzione, senza contare azioni`,
    },
  ];
}

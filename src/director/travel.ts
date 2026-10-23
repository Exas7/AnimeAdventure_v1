import { reachableCells, travelRule, type GameContext, type GameState, type PlayerId } from '../engine';

/** "Usa" on a travel item (spec 047): whose pawn, which item, in which turn. */
export interface TravelChoice {
  player: PlayerId;
  itemId: string;
  turn: number;
  /** Copies of the item when the choice started: one fewer means it was used (or taken away). */
  copies: number;
}

/** How many copies of the item the player holds. */
export function copiesOf(state: GameState, player: PlayerId, itemId: string): number {
  return state.players[player].inventory.filter((held) => held === itemId).length;
}

/**
 * The choice of the cell, while it is still on: it goes off when the pawn
 * arrives or the item leaves the inventory (one copy fewer, even with more
 * copies left), at the end of the turn, or with "Annulla" and Esc (the
 * director forgets it).
 */
export function activeTravel(state: GameState, travel: TravelChoice | null): TravelChoice | null {
  if (!travel || travel.turn !== state.turn) {
    return null;
  }
  return copiesOf(state, travel.player, travel.itemId) >= travel.copies ? travel : null;
}

/** The cells to highlight on both windows, in a stable order; null when no choice is on. */
export function travelCells(
  context: GameContext,
  state: GameState,
  travel: TravelChoice | null,
): string[] | null {
  const active = activeTravel(state, travel);
  const item = active && context.items.find((candidate) => candidate.id === active.itemId);
  const rule = item ? travelRule(item) : undefined;
  if (!active || !rule) {
    return null;
  }
  if (state.players[active.player].noMovesTurn && active.player === state.currentPlayer) {
    return [];
  }
  return [...reachableCells(context.map, state, active.player, rule.steps)].sort();
}

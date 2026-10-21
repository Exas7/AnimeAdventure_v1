/**
 * Completed missions the host answered "Non ancora" (spec 026, 2.4): quiet
 * for the rest of the turn, back at the next one if still completed. Kept
 * by the director only, never in the game.
 */
export interface NotYet {
  turn: number;
  ids: number[];
}

export const NOTHING_POSTPONED: NotYet = { turn: 0, ids: [] };

/** "Non ancora" on a mission, during this turn. */
export function postpone(notYet: NotYet, turn: number, missionId: number): NotYet {
  return notYet.turn === turn
    ? { turn, ids: [...notYet.ids, missionId] }
    : { turn, ids: [missionId] };
}

/** Whether the notice of a completed mission waits: only in the turn it was postponed. */
export function isPostponed(notYet: NotYet, turn: number, missionId: number): boolean {
  return notYet.turn === turn && notYet.ids.includes(missionId);
}

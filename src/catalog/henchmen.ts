// The henchmen of the story (spec 069, 2.1; D-095): Saibaiman, and Cell Jr.
// with Cell. They only join the opponents of team fights, as many as are
// missing: never in a cell, a shop, among the starters, as a target or a
// reward.

export const CELL_JR = 'cell-jr';
export const SAIBAIMAN = 'saibaiman';

/** The person of every form of Cell (the «persona» column). */
export const CELL_PERSON = 'Cell (prima forma)';

export function isHenchman(characterId: string): boolean {
  return characterId === CELL_JR || characterId === SAIBAIMAN;
}

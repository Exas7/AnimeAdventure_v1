import type { Character, FightMove } from '../engine';

// Character sheets of the fight simulator (spec 035, 2.2): made up by us, in
// line with Budokai Tenkaichi 3. The tier says how strong a character is;
// the sheet only says how it fights (the engine evens it out, fight.ts).
// They live in the character list, one column each (spec 037, D-059).

/** A wave can be countered by anything; a rush does not work on giants (spec 035, 2.4). */
export type MoveKind = FightMove['kind'];

export type Move = FightMove;

export interface Sheet {
  /** Health bars of 10,000 HP each, from 3 to 5. */
  bars: number;
  /** From 1 to 5: how much a blow takes. Power + speed = 6. */
  power: number;
  /** From 1 to 5: how often the character attacks, and dodges. */
  speed: number;
  /** Rush moves do not work on giants. */
  giant: boolean;
  /** The two base special moves (the Blast 2 of BT3). */
  moves: readonly [Move, Move];
  /** The Ultimate Blast of BT3. */
  finale: Move;
}

/** Everyone without a sheet of their own, and every empty column. */
export const NORMAL_SHEET: Sheet = {
  bars: 4,
  power: 3,
  speed: 3,
  giant: false,
  moves: [
    { name: 'Onda energetica', kind: 'wave' },
    { name: 'Impeto', kind: 'rush' },
  ],
  finale: { name: 'Mossa finale', kind: 'wave' },
};

/** The sheet of a character of the list: its columns, the normal sheet where they are empty. */
export function sheetOf(character: Character): Sheet {
  const own = character.fight;
  if (!own) {
    return NORMAL_SHEET;
  }
  return {
    bars: own.bars ?? NORMAL_SHEET.bars,
    power: own.power ?? NORMAL_SHEET.power,
    speed: own.speed ?? NORMAL_SHEET.speed,
    giant: own.giant ?? NORMAL_SHEET.giant,
    moves: [own.move1 ?? NORMAL_SHEET.moves[0], own.move2 ?? NORMAL_SHEET.moves[1]],
    finale: own.finale ?? NORMAL_SHEET.finale,
  };
}

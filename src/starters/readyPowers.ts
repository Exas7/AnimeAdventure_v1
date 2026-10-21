import type { PowerDefinition } from '../engine';
import { looksLikePowerForm, newPowerForm, powerDefinition, type PowerForm } from './powerForm';

// The list of ready powers (spec 025, D-037): kept in the browser apart from
// the character list, and copied into the episodes and games that use them.

/** A power of the list: what the starter card says, and the effect behind it. */
export interface ReadyPower {
  id: string;
  /**
   * The text on the starter card, e.g. "Ogni 2 turni guadagni 200$". It may
   * hold {iniziali} and {totale}, filled with the coins of the game (spec 029).
   */
  cardText: string;
  effect: PowerForm;
}

/** A new code: editing a power makes a new version with a new code, as for shopkeepers. */
export function newReadyPowerId(): string {
  return `potere-${crypto.randomUUID()}`;
}

export function makeReadyPower(id: string, cardText: string, effect: PowerForm): ReadyPower {
  return { id, cardText: cardText.trim(), effect };
}

/** The three powers of the channel's graphic: the list starts with them (spec 025, 2.1). */
export const DEFAULT_READY_POWERS: ReadyPower[] = [
  makeReadyPower('potere-ogni-2-turni-200', 'Ogni 2 turni guadagni 200$', {
    ...newPowerForm('coinsEveryNTurns'),
    amount: 200,
    n: 2,
  }),
  makeReadyPower(
    'potere-ogni-interazione-250',
    'Ogni volta che interagisci con un PG prendi 250$',
    { ...newPowerForm('coinsPerInteraction'), amount: 250 },
  ),
  // The numbers follow the starting coins of the game (spec 029, 2.5).
  makeReadyPower('potere-parti-con-3500', 'Parti con {totale} invece che {iniziali}', {
    ...newPowerForm('extraStartingCoins'),
    amount: 2500,
  }),
];

/** The power as the engine knows it, with the same values and own name. */
export function readyPowerDefinition(power: ReadyPower): PowerDefinition {
  return powerDefinition(power.effect);
}

/** Checks the shape of a ready power read from the browser or from a file. */
export function looksLikeReadyPower(value: unknown): value is ReadyPower {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const power = value as Record<string, unknown>;
  return (
    typeof power.id === 'string' &&
    power.id !== '' &&
    typeof power.cardText === 'string' &&
    looksLikePowerForm(power.effect)
  );
}

/**
 * The powers a menu offers: those of the list, then the copies kept by an
 * episode or a form whose version the list no longer has (spec 025, 2.1).
 */
export function availablePowers(
  library: ReadyPower[],
  copies: ReadyPower[],
): { library: ReadyPower[]; onlyHere: ReadyPower[] } {
  const known = new Set(library.map((power) => power.id));
  const onlyHere: ReadyPower[] = [];
  for (const copy of copies) {
    if (!known.has(copy.id)) {
      known.add(copy.id);
      onlyHere.push(copy);
    }
  }
  return { library, onlyHere };
}

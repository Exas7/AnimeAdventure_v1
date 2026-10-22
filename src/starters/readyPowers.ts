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

/**
 * Son Gohan's power in the channel's graphic (spec 028), with the effect of
 * spec 061 (D-090) and two uses since spec 063. Browsers used before get it
 * once (storage versions 9 and 10).
 */
export const RETRY_LOST_CHALLENGE_POWER: ReadyPower = makeReadyPower(
  'potere-ritenta-sfida-persa-2',
  'Due volte per partita puoi ritentare una sfida persa',
  { ...newPowerForm('retryLostChallenge'), uses: 2 },
);

/** The powers that give no coins have two uses (spec 063, 2.2). */
export const DOUBLE_MOVE_POWER: ReadyPower = makeReadyPower(
  'potere-doppio-movimento-2',
  'Due volte per partita: doppio movimento (2 azioni in più)',
  { ...newPowerForm('extraActionsOnDemand'), name: 'Doppio movimento', amount: 2, uses: 2 },
);

export const SKIP_TURN_POWER: ReadyPower = makeReadyPower(
  'potere-salta-turno-2',
  "Due volte per partita fai saltare un turno all'avversario",
  { ...newPowerForm('skipOpponentTurn'), name: 'Salta turno', uses: 2 },
);

/** «Parti con …»: 1,500 coins more since spec 063 (it was 2,500). The numbers follow the starting coins (spec 029, 2.5). */
const EXTRA_STARTING_COINS_POWER: ReadyPower = makeReadyPower(
  'potere-parti-con-2500',
  'Parti con {totale} invece che {iniziali}',
  { ...newPowerForm('extraStartingCoins'), amount: 1500 },
);

/**
 * The ready powers of before spec 063 and what takes their place in a
 * browser that still has them unchanged (storage version 10).
 */
export const REPLACED_READY_POWERS: [ReadyPower, ReadyPower][] = [
  [
    makeReadyPower('potere-parti-con-3500', 'Parti con {totale} invece che {iniziali}', {
      ...newPowerForm('extraStartingCoins'),
      amount: 2500,
    }),
    EXTRA_STARTING_COINS_POWER,
  ],
  [
    makeReadyPower('potere-ritenta-sfida-persa', 'Una volta per partita puoi ritentare una sfida persa', {
      ...newPowerForm('retryLostChallenge'),
      uses: 1,
    }),
    RETRY_LOST_CHALLENGE_POWER,
  ],
];

/** True when two ready powers say and do the same: same code, card and effect. */
export function sameReadyPower(a: ReadyPower, b: ReadyPower): boolean {
  const fields: (keyof PowerForm)[] = ['kind', 'name', 'amount', 'n', 'uses', 'text', 'moment'];
  return a.id === b.id && a.cardText === b.cardText && fields.every((field) => a.effect[field] === b.effect[field]);
}

/**
 * The ready powers a new browser starts with: the three of coins of the
 * channel's graphic and three without coins, two uses each (spec 025, 2.1;
 * spec 061; spec 063).
 */
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
  EXTRA_STARTING_COINS_POWER,
  RETRY_LOST_CHALLENGE_POWER,
  DOUBLE_MOVE_POWER,
  SKIP_TURN_POWER,
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

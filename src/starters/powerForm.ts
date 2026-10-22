import { powerCatalog, type PowerDefinition, type Trigger } from '../engine';

export type PowerKind = keyof typeof powerCatalog;

export type ReminderMoment =
  | 'gameStart'
  | 'turnStart'
  | 'turnEnd'
  | 'everyNTurns'
  | 'interaction'
  | 'manual';

/** One power as edited by the host: the kind of the catalog and its values. */
export interface PowerForm {
  kind: PowerKind;
  /** Own name shown in notifications (e.g. "Doppio movimento"); empty for the default. */
  name: string;
  amount: number;
  n: number;
  uses: number;
  text: string;
  moment: ReminderMoment;
}

export type PowerField = 'amount' | 'n' | 'uses' | 'text' | 'moment';

/** The power catalog of spec 001, section 6, with the values each power needs. */
export const POWER_KINDS: { kind: PowerKind; label: string; fields: PowerField[] }[] = [
  { kind: 'extraStartingCoins', label: 'Monete iniziali extra', fields: ['amount'] },
  { kind: 'coinsEveryNTurns', label: 'Monete ogni N turni', fields: ['amount', 'n'] },
  { kind: 'coinsPerInteraction', label: 'Monete a ogni interazione', fields: ['amount'] },
  { kind: 'coinsAtTurnEnd', label: 'Monete a fine turno', fields: ['amount'] },
  { kind: 'fixedExtraActions', label: 'Azioni extra fisse', fields: ['amount'] },
  { kind: 'extraActionsOnDemand', label: 'Azioni extra a comando', fields: ['amount', 'uses'] },
  { kind: 'skipOpponentTurn', label: 'Fai perdere un turno', fields: ['uses'] },
  { kind: 'reminder', label: 'Promemoria', fields: ['text', 'moment'] },
  // Spec 061, D-090: the app offers it on the character who beat the player.
  { kind: 'retryLostChallenge', label: 'Ritenta una sfida persa', fields: ['uses'] },
];

export const REMINDER_MOMENTS: { moment: ReminderMoment; label: string }[] = [
  { moment: 'manual', label: 'A mano' },
  { moment: 'gameStart', label: 'A inizio partita' },
  { moment: 'turnStart', label: "All'inizio di ogni turno" },
  { moment: 'turnEnd', label: 'Alla fine di ogni turno' },
  { moment: 'everyNTurns', label: 'Ogni N turni' },
  { moment: 'interaction', label: 'A ogni interazione' },
];

export function newPowerForm(kind: PowerKind): PowerForm {
  const actions = kind === 'fixedExtraActions' || kind === 'extraActionsOnDemand';
  return { kind, name: '', amount: actions ? 2 : 100, n: 2, uses: 1, text: '', moment: 'manual' };
}

/** The values that matter for a power, given its kind and, for reminders, its moment. */
export function powerFields(power: PowerForm): PowerField[] {
  const fields = POWER_KINDS.find((entry) => entry.kind === power.kind)?.fields ?? [];
  if (power.kind !== 'reminder') {
    return fields;
  }
  if (power.moment === 'everyNTurns') {
    return [...fields, 'n'];
  }
  if (power.moment === 'manual') {
    return [...fields, 'uses'];
  }
  return fields;
}

export function powerDefinition(power: PowerForm): PowerDefinition {
  const name = power.name.trim() || undefined;
  switch (power.kind) {
    case 'extraStartingCoins':
      return powerCatalog.extraStartingCoins(power.amount, name);
    case 'coinsEveryNTurns':
      return powerCatalog.coinsEveryNTurns(power.amount, power.n, name);
    case 'coinsPerInteraction':
      return powerCatalog.coinsPerInteraction(power.amount, name);
    case 'coinsAtTurnEnd':
      return powerCatalog.coinsAtTurnEnd(power.amount, name);
    case 'fixedExtraActions':
      return powerCatalog.fixedExtraActions(power.amount, name);
    case 'extraActionsOnDemand':
      return powerCatalog.extraActionsOnDemand(power.amount, power.uses, name);
    case 'skipOpponentTurn':
      return powerCatalog.skipOpponentTurn(power.uses, name);
    case 'reminder':
      return powerCatalog.reminder(power.text, reminderTrigger(power), name);
    case 'retryLostChallenge':
      return powerCatalog.retryLostChallenge(power.uses, name);
  }
}

/**
 * The effect in words, for the list of powers (spec 025): "Monete ogni 2
 * turni: +200". Only the values that matter for the kind are mentioned.
 */
export function describePower(power: PowerForm): string {
  const label = POWER_KINDS.find((entry) => entry.kind === power.kind)?.label ?? power.kind;
  const uses = `${power.uses} ${power.uses === 1 ? 'uso' : 'usi'}`;
  const own = power.name.trim() ? ` · «${power.name.trim()}»` : '';
  switch (power.kind) {
    case 'coinsEveryNTurns':
      return `Monete ogni ${power.n} turni: ${signed(power.amount)}${own}`;
    case 'extraStartingCoins':
    case 'coinsPerInteraction':
    case 'coinsAtTurnEnd':
    case 'fixedExtraActions':
      return `${label}: ${signed(power.amount)}${own}`;
    case 'extraActionsOnDemand':
      return `${label}: ${signed(power.amount)}, ${uses}${own}`;
    case 'skipOpponentTurn':
    case 'retryLostChallenge':
      return `${label}: ${uses}${own}`;
    case 'reminder': {
      const moment =
        power.moment === 'everyNTurns'
          ? `ogni ${power.n} turni`
          : (REMINDER_MOMENTS.find((entry) => entry.moment === power.moment)?.label ?? '').toLowerCase();
      const extra = power.moment === 'manual' ? `, ${uses}` : '';
      return `${label} (${moment}${extra}): «${power.text.trim()}»${own}`;
    }
  }
}

/** Checks the shape of a power form read from the browser or from a file. */
export function looksLikePowerForm(value: unknown): value is PowerForm {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const form = value as Record<string, unknown>;
  const number = (key: string) => typeof form[key] === 'number' && Number.isFinite(form[key]);
  return (
    POWER_KINDS.some((entry) => entry.kind === form.kind) &&
    typeof form.name === 'string' &&
    typeof form.text === 'string' &&
    REMINDER_MOMENTS.some((entry) => entry.moment === form.moment) &&
    ['amount', 'n', 'uses'].every(number)
  );
}

function signed(amount: number): string {
  return amount < 0 ? String(amount) : `+${amount}`;
}

function reminderTrigger(power: PowerForm): Trigger {
  switch (power.moment) {
    case 'everyNTurns':
      return { type: 'everyNTurns', n: power.n };
    case 'manual':
      return { type: 'manual', uses: power.uses };
    case 'gameStart':
    case 'turnStart':
    case 'turnEnd':
    case 'interaction':
      return { type: power.moment };
  }
}

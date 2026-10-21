import { opponentOf } from './lookup';
import { notify, signed, type ActionOutput } from './output';
import type { Effect, GameState, PlayerId, PowerDefinition, PowerState, Trigger } from './types';

/**
 * Ready-made powers from the catalog in spec 001, section 6. A custom name
 * (e.g. "Doppio movimento") replaces the generic one in notifications.
 */
export const powerCatalog = {
  extraStartingCoins: (amount: number, name = 'Monete iniziali extra'): PowerDefinition => ({
    name,
    trigger: { type: 'gameStart' },
    effect: { type: 'addCoins', amount },
  }),
  coinsEveryNTurns: (amount: number, n: number, name = 'Monete ogni N turni'): PowerDefinition => ({
    name,
    trigger: { type: 'everyNTurns', n },
    effect: { type: 'addCoins', amount },
  }),
  coinsPerInteraction: (amount: number, name = 'Monete a ogni interazione'): PowerDefinition => ({
    name,
    trigger: { type: 'interaction' },
    effect: { type: 'addCoins', amount },
  }),
  coinsAtTurnEnd: (amount: number, name = 'Monete a fine turno'): PowerDefinition => ({
    name,
    trigger: { type: 'turnEnd' },
    effect: { type: 'addCoins', amount },
  }),
  fixedExtraActions: (amount: number, name = 'Azioni extra fisse'): PowerDefinition => ({
    name,
    trigger: { type: 'turnStart' },
    effect: { type: 'extraActions', amount },
  }),
  extraActionsOnDemand: (
    amount: number,
    uses: number,
    name = 'Azioni extra a comando',
  ): PowerDefinition => ({
    name,
    trigger: { type: 'manual', uses },
    effect: { type: 'extraActions', amount },
  }),
  skipOpponentTurn: (uses: number, name = 'Fai perdere un turno'): PowerDefinition => ({
    name,
    trigger: { type: 'manual', uses },
    effect: { type: 'skipOpponentTurn' },
  }),
  reminder: (text: string, trigger: Trigger, name = 'Promemoria'): PowerDefinition => ({
    name,
    trigger,
    effect: { type: 'reminder', text },
  }),
};

/** Fires every power of the owner whose trigger matches. */
export function firePowers(
  state: GameState,
  ownerId: PlayerId,
  matches: (trigger: Trigger) => boolean,
  out: ActionOutput,
): void {
  for (const power of state.players[ownerId].powers) {
    if (matches(power.definition.trigger)) {
      applyPower(state, ownerId, power, out);
    }
  }
}

/** Applies a power and records a notification for the screen and a line for the log. */
export function applyPower(
  state: GameState,
  ownerId: PlayerId,
  power: PowerState,
  out: ActionOutput,
): void {
  const result = applyEffect(state, ownerId, power.definition.effect);
  notify(state, out, `${state.players[ownerId].name} · ${power.definition.name}: ${result}`);
}

/** Changes the state and returns a short description of what happened. */
function applyEffect(state: GameState, ownerId: PlayerId, effect: Effect): string {
  switch (effect.type) {
    case 'addCoins':
      state.players[ownerId].coins += effect.amount;
      return `${signed(effect.amount)} monete`;
    case 'extraActions':
      state.actions.available += effect.amount;
      return `${signed(effect.amount)} azioni`;
    case 'skipOpponentTurn': {
      const opponent = state.players[opponentOf(ownerId)];
      opponent.turnsToSkip += 1;
      return `${opponent.name} salta il prossimo turno`;
    }
    case 'reminder':
      return effect.text;
  }
}

import {
  activeMissionParts,
  rechargesStarter,
  TEAM_SIZE,
  trainingRule,
  trainingRuleText,
  travelRule,
  type Character,
  type GameState,
  type ItemDefinition,
  type PlayerId,
  type PowerDefinition,
} from '../engine';

// What the «i» of a player's column shows on the phone (spec 064, 2.1): the
// powers with their uses, the items, the missions in progress in full, the
// lost challenges and the sixth character.

export interface PlayerInfo {
  powers: { name: string; text: string; usesLeft: number | null }[];
  items: { name: string; text: string }[];
  missions: { id: number; giver: string; task: string }[];
  lostTo: string[];
  sixth: string;
}

const coins = (amount: number) => `${amount > 0 ? '+' : ''}${amount} monete`;

/** What a power does, in words: its trigger and its effect. */
export function powerText(definition: PowerDefinition): string {
  const { trigger, effect } = definition;
  if (effect.type === 'reminder') {
    return effect.text;
  }
  if (effect.type === 'retryChallenge') {
    return "sfidi di nuovo un personaggio che ti ha battuto: l'app te lo propone quando lo tocchi";
  }
  if (effect.type === 'skipOpponentTurn') {
    return "l'avversario salta il suo prossimo turno";
  }
  const what = effect.type === 'addCoins' ? coins(effect.amount) : `${effect.amount > 0 ? '+' : ''}${effect.amount} azioni`;
  switch (trigger.type) {
    case 'gameStart':
      return `${what} a inizio partita`;
    case 'turnStart':
      return `${what} a ogni turno`;
    case 'turnEnd':
      return `${what} a fine turno`;
    case 'everyNTurns':
      return `${what} ogni ${trigger.n} turni`;
    case 'interaction':
      return `${what} ogni volta che interagisci con un personaggio`;
    case 'manual':
      return effect.type === 'extraActions' ? `${what} nel turno in cui lo usi` : `${what} quando lo usi`;
  }
}

/** What an item does, in words. */
export function itemText(item: ItemDefinition): string {
  const training = trainingRule(item);
  if (training) {
    return trainingRuleText(training);
  }
  const travel = travelRule(item);
  if (travel) {
    return travel.steps === null ? 'porta la pedina su qualsiasi casella' : `porta la pedina fino a ${travel.steps} caselle più in là`;
  }
  if (rechargesStarter(item)) {
    return 'ricarica il potere dello starter';
  }
  return '';
}

export function playerInfo(state: GameState, catalog: Character[], items: ItemDefinition[], playerId: PlayerId): PlayerInfo {
  const player = state.players[playerId];
  const name = (id: string | undefined) => catalog.find((character) => character.id === id)?.name ?? id ?? '?';
  const owned = player.inventory.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? [{ name: item.name, text: itemText(item) }] : [];
  });
  const sixth =
    player.sixthTaken === true
      ? 'già arruolato: la squadra non prende altri personaggi'
      : player.team.length >= TEAM_SIZE
        ? 'disponibile: con la squadra completa puoi arruolarne un altro e poi cacciarne uno'
        : 'ancora disponibile, una volta per partita, quando la squadra sarà completa';
  return {
    powers: player.powers.map((power) => ({
      name: power.definition.name,
      text: powerText(power.definition),
      usesLeft: power.usesLeft,
    })),
    items: owned,
    missions: (state.activeMissions ?? [])
      .filter((active) => active.player === playerId)
      .map((active) => ({ id: active.id, ...activeMissionParts(active, state, catalog) })),
    lostTo: (state.defeats ?? [])
      .filter((defeat) => defeat.player === playerId)
      .map((defeat) => name(state.cells[defeat.nodeId]?.characterId)),
    sixth,
  };
}

import { EngineError } from './errors';
import { findCharacter, findItem, findNode } from './lookup';
import { notify, signed, type ActionOutput } from './output';
import { addToTeam } from './team';
import type {
  Character,
  GameContext,
  GameState,
  ItemDefinition,
  MapNode,
  PlayerId,
  PowerState,
} from './types';

// Buying never consumes actions and is not an interaction (spec 002,
// section 4): nothing here touches the turn counter or fires powers.
// Off-guide purchases (sold, sold out, already bought, full team, Senzu
// without effect) are turn rules (D-015): their warnings come from rules.ts.

export function buyCharacter(
  state: GameState,
  context: GameContext,
  shopNodeId: string,
  characterId: string,
  out: ActionOutput,
): void {
  if (!forSaleIn(state, context, shopNodeId).includes(characterId)) {
    throw new EngineError(`Character "${characterId}" is not for sale in shop "${shopNodeId}"`);
  }
  const character = findCharacter(context.catalog, characterId);
  const buyerId = state.currentPlayer;

  if (state.soldCharacters[characterId] === undefined) {
    state.soldCharacters[characterId] = buyerId;
  }
  state.players[buyerId].coins -= characterPrice(state, character);
  addToTeam(state, context, buyerId, characterId, out, { warnIfFull: false });
}

export function buyItem(
  state: GameState,
  context: GameContext,
  shopNodeId: string,
  itemId: string,
  out: ActionOutput,
): void {
  findShop(context, shopNodeId);
  const item = findItem(context.items, itemId);
  const buyerId = state.currentPlayer;
  const buyer = state.players[buyerId];

  state.itemPurchases.push({ itemId: item.id, shopNodeId, player: buyerId });
  buyer.coins -= itemPrice(state, item);

  if (item.onPurchase === 'rechargeStarter') {
    rechargeStarter(state, buyerId, item, out);
  } else {
    buyer.inventory.push(item.id);
  }
}

export interface ShopCharacterListing {
  characterId: string;
  name: string;
  price: number;
  /** Who bought it first, or null if still for sale. */
  soldTo: PlayerId | null;
}

export interface ShopItemListing {
  itemId: string;
  name: string;
  price: number;
  soldOut: boolean;
  /** Only for "once per player" items: the viewer already bought one. */
  alreadyBought: boolean;
}

export interface ShopListing {
  shopNodeId: string;
  shopkeeperId: string | null;
  characters: ShopCharacterListing[];
  items: ShopItemListing[];
}

/**
 * What a shop shows to a player. Sold, sold out and already bought entries
 * are meant to appear grey, but they stay buyable (D-006, D-015).
 */
export function shopListing(
  state: GameState,
  context: GameContext,
  shopNodeId: string,
  viewer: PlayerId,
): ShopListing {
  findShop(context, shopNodeId);
  return {
    shopNodeId,
    shopkeeperId: state.cells[shopNodeId]?.characterId ?? null,
    characters: forSaleIn(state, context, shopNodeId).map((characterId) => {
      const character = findCharacter(context.catalog, characterId);
      return {
        characterId,
        name: character.name,
        price: characterPrice(state, character),
        soldTo: state.soldCharacters[characterId] ?? null,
      };
    }),
    items: context.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      price: itemPrice(state, item),
      soldOut: isSoldOut(state, item, shopNodeId),
      alreadyBought: item.oncePerPlayer && hasBought(state, item.id, viewer),
    })),
  };
}

/** Current price: the one set by the host, or the catalog value. */
export function characterPrice(state: GameState, character: Character): number {
  // A character without a price, put in a shop anyway, starts at 0 (spec 005).
  return state.characterPrices[character.id] ?? character.price ?? 0;
}

export function itemPrice(state: GameState, item: ItemDefinition): number {
  return state.itemPrices[item.id] ?? item.price;
}

export function isSoldOut(state: GameState, item: ItemDefinition, shopNodeId: string): boolean {
  if (item.copiesPerShop === null) {
    return false;
  }
  const sold = state.itemPurchases.filter(
    (purchase) => purchase.itemId === item.id && purchase.shopNodeId === shopNodeId,
  ).length;
  return sold >= item.copiesPerShop;
}

export function hasBought(state: GameState, itemId: string, playerId: PlayerId): boolean {
  return state.itemPurchases.some(
    (purchase) => purchase.itemId === itemId && purchase.player === playerId,
  );
}

/**
 * The power a Senzu would recharge: a manual power, or extra starting coins;
 * the one named, when the Senzu is used for it (spec 061, 2.1).
 */
export function rechargeablePower(state: GameState, playerId: PlayerId, powerId?: string): PowerState | undefined {
  return state.players[playerId].powers.find((power) => {
    const { trigger, effect } = power.definition;
    const rechargeable = trigger.type === 'manual' || (trigger.type === 'gameStart' && effect.type === 'addCoins');
    return rechargeable && (powerId === undefined || power.id === powerId);
  });
}

/**
 * Senzu: recharges the first rechargeable power of the buyer's starter,
 * when it is bought or, from the inventory, with "Usa" (spec 047).
 * A manual power gets one use back; extra starting coins are paid again.
 * With nothing to recharge it does nothing (the turn rules warned before).
 */
export function rechargeStarter(
  state: GameState,
  playerId: PlayerId,
  item: ItemDefinition,
  out: ActionOutput,
  powerId?: string,
): void {
  const player = state.players[playerId];
  const power = rechargeablePower(state, playerId, powerId);
  if (!power) {
    return;
  }
  const { effect } = power.definition;
  if (power.usesLeft !== null) {
    power.usesLeft += 1;
    notify(state, out, `${player.name} · ${item.name}: ${power.definition.name} +1 uso`);
  } else if (effect.type === 'addCoins') {
    player.coins += effect.amount;
    notify(state, out, `${player.name} · ${item.name}: ${signed(effect.amount)} monete`);
  }
}

function forSaleIn(state: GameState, context: GameContext, shopNodeId: string): string[] {
  findShop(context, shopNodeId);
  return state.cells[shopNodeId]?.forSale ?? [];
}

function findShop(context: GameContext, nodeId: string): MapNode {
  const node = findNode(context.map, nodeId);
  if (node.type !== 'shop') {
    throw new EngineError(`Node "${nodeId}" is not a shop`);
  }
  return node;
}

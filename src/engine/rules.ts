import { cellLabel, findCharacter, findItem } from './lookup';
import { hasBought, isSoldOut, rechargeablePower } from './shop';
import {
  TEAM_SIZE,
  type GameAction,
  type GameContext,
  type GameMap,
  type GameState,
  type PlayerId,
  type Warning,
} from './types';

/**
 * Turn-rule warnings an action would produce, without applying it: moves and
 * interactions on the board (D-013, D-014), shop purchases (D-015) and the
 * end of a turn with actions left (D-033).
 * Kinds already given this turn are left out: each is given once per turn.
 * The director asks for a second click when this is not empty.
 */
export function turnRuleWarnings(
  state: GameState,
  action: GameAction,
  context: GameContext,
): Warning[] {
  let warnings: Warning[];
  switch (action.type) {
    case 'move':
      warnings = boardWarnings(state, action, context);
      break;
    case 'interact':
      // Reopening the scene where the player already interacted: no rules apply (spec 020).
      warnings = isRepeatInteraction(state, action.nodeId)
        ? []
        : boardWarnings(state, action, context);
      break;
    case 'buyCharacter':
      warnings = characterPurchaseWarnings(state, action.characterId, context);
      break;
    case 'buyItem':
      warnings = itemPurchaseWarnings(state, action.shopNodeId, action.itemId, context);
      break;
    case 'endTurn':
      warnings = endTurnWarnings(state);
      break;
    default:
      return [];
  }
  return warnings.filter((warning) => !state.acknowledgedThisTurn.includes(warning.kind));
}

/**
 * True if the current player already interacted with this cell, where the
 * pawn still stands, in this turn: interacting again only reopens the scene
 * and counts nothing (spec 020, 2.4).
 */
export function isRepeatInteraction(state: GameState, nodeId: string): boolean {
  return (
    state.interactedNodeId === nodeId &&
    state.players[state.currentPlayer].position === nodeId
  );
}

/** True if a path open for the player connects the two cells, in either direction. */
export function isAdjacent(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  fromNodeId: string,
  toNodeId: string,
): boolean {
  return map.edges.some((edge) => {
    const connects =
      (edge.from === fromNodeId && edge.to === toNodeId) ||
      (edge.from === toNodeId && edge.to === fromNodeId);
    const closed = state.edgeLocks[edge.id]?.[playerId] ?? edge.locked;
    return connects && !closed;
  });
}

function boardWarnings(
  state: GameState,
  action: Extract<GameAction, { type: 'move' | 'interact' }>,
  context: GameContext,
): Warning[] {
  const playerId = state.currentPlayer;
  const player = state.players[playerId];
  const { actions } = state;
  const label = (nodeId: string) => cellLabel(state, context.map, context.catalog, nodeId);
  const warnings: Warning[] = [];

  if (actions.used >= actions.available) {
    warnings.push({
      kind: 'noActionsLeft',
      message: `${player.name} ha già usato tutte le azioni del turno`,
    });
  }
  if (action.type === 'interact') {
    if (actions.interactionsUsed >= actions.interactionsAvailable) {
      warnings.push({
        kind: 'noInteractionsLeft',
        message: `${player.name} ha già usato le interazioni del turno`,
      });
    }
    const conqueror = state.conquests[action.nodeId];
    if (conqueror !== undefined) {
      warnings.push({
        kind: 'nodeAlreadyConquered',
        message: `${state.players[conqueror].name} ha già conquistato ${label(action.nodeId)}`,
      });
    }
  }
  if (
    action.type === 'move' &&
    !isAdjacent(context.map, state, playerId, player.position, action.to)
  ) {
    warnings.push({
      kind: 'notAdjacent',
      message: `Mossa non adiacente: nessun percorso aperto per ${player.name} porta a ${label(action.to)}`,
    });
  }
  return warnings;
}

/** Ending the turn with actions still available (D-033). */
function endTurnWarnings(state: GameState): Warning[] {
  const left = state.actions.available - state.actions.used;
  if (left <= 0) {
    return [];
  }
  const { name } = state.players[state.currentPlayer];
  return [
    {
      kind: 'actionsLeft',
      message: `${name} ha ancora ${left} ${left === 1 ? 'azione' : 'azioni'} nel turno`,
    },
  ];
}

function characterPurchaseWarnings(
  state: GameState,
  characterId: string,
  context: GameContext,
): Warning[] {
  const character = findCharacter(context.catalog, characterId);
  const buyer = state.players[state.currentPlayer];
  const warnings: Warning[] = [];

  const firstBuyer = state.soldCharacters[characterId];
  if (firstBuyer !== undefined) {
    warnings.push({
      kind: 'characterAlreadySold',
      message: `${state.players[firstBuyer].name} ha già comprato ${character.name}`,
    });
  }
  if (buyer.team.length >= TEAM_SIZE) {
    warnings.push({ kind: 'teamFull', message: `La squadra di ${buyer.name} è completa` });
  }
  return warnings;
}

function itemPurchaseWarnings(
  state: GameState,
  shopNodeId: string,
  itemId: string,
  context: GameContext,
): Warning[] {
  const item = findItem(context.items, itemId);
  const buyerId = state.currentPlayer;
  const buyer = state.players[buyerId];
  const warnings: Warning[] = [];

  if (isSoldOut(state, item, shopNodeId)) {
    warnings.push({
      kind: 'itemSoldOut',
      message: `In questo negozio non ci sono più copie di ${item.name}`,
    });
  }
  if (item.oncePerPlayer && hasBought(state, item.id, buyerId)) {
    warnings.push({
      kind: 'itemAlreadyBought',
      message: `${buyer.name} ha già comprato ${item.name}`,
    });
  }
  if (item.onPurchase === 'rechargeStarter' && !rechargeablePower(state, buyerId)) {
    warnings.push({
      kind: 'nothingToRecharge',
      message: `Lo starter di ${buyer.name} non ha poteri da ricaricare`,
    });
  }
  return warnings;
}

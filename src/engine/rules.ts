import { cellLabel, findCharacter, findItem, opponentOf } from './lookup';
import { rechargesStarter, travelRule } from './itemUse';
import { hasBought, isSoldOut, rechargeablePower } from './shop';
import { teamIsFull } from './team';
import { isOffCell } from './fusions';
import { awayCells } from './missions';
import {
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
    case 'useItem':
      warnings = itemUseWarnings(state, action, context);
      break;
    default:
      return [];
  }
  return warnings.filter((warning) => !state.acknowledgedThisTurn.includes(warning.kind));
}

/** True when the player lost the challenge of this cell (spec 061, D-090). */
export function hasLostAt(state: GameState, playerId: PlayerId, nodeId: string): boolean {
  return (state.defeats ?? []).some((defeat) => defeat.player === playerId && defeat.nodeId === nodeId);
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
    return connects && isOpenFor(state, playerId, edge);
  });
}

/** A path is open for a player unless it is locked for them (D-027). */
function isOpenFor(state: GameState, playerId: PlayerId, edge: GameMap['edges'][number]): boolean {
  return !(state.edgeLocks[edge.id]?.[playerId] ?? edge.locked);
}

/**
 * The cells the player's pawn reaches along the paths open for them, at
 * most `steps` paths away (null: any distance), its own cell left out
 * (spec 047: Nuvola Speedy, Trasmissione Istantanea).
 */
export function reachableCells(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  steps: number | null,
): Set<string> {
  const start = state.players[playerId].position;
  const neighbours = new Map<string, string[]>();
  for (const edge of map.edges) {
    if (isOpenFor(state, playerId, edge)) {
      neighbours.set(edge.from, [...(neighbours.get(edge.from) ?? []), edge.to]);
      neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from]);
    }
  }
  const distance = new Map<string, number>([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index] as string;
    const next = (distance.get(nodeId) ?? 0) + 1;
    if (steps !== null && next > steps) {
      continue;
    }
    for (const neighbour of neighbours.get(nodeId) ?? []) {
      if (!distance.has(neighbour)) {
        distance.set(neighbour, next);
        queue.push(neighbour);
      }
    }
  }
  distance.delete(start);
  // A trip never ends on the opponent's cell (spec 086, D-108).
  distance.delete(state.players[opponentOf(playerId)].position);
  return new Set(distance.keys());
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
    const travelling = awayCells(state).get(action.nodeId);
    if (travelling !== undefined) {
      warnings.push({
        kind: 'companionAway',
        message: `${label(action.nodeId)} è in viaggio con ${state.players[travelling].name}`,
      });
    }
    if (isOffCell(state, action.nodeId)) {
      warnings.push({
        kind: 'cellOff',
        message: `${label(action.nodeId)} è spenta: quel personaggio è entrato in una fusione`,
      });
    }
    if (hasLostAt(state, playerId, action.nodeId)) {
      warnings.push({
        kind: 'challengeLost',
        message: `${player.name} ha già perso contro ${label(action.nodeId)}: non può sfidarlo di nuovo`,
      });
    }
  }
  if (action.type === 'move' && player.noMovesTurn) {
    warnings.push({
      kind: 'noMovesTurn',
      message: `${player.name} non può muoversi: nel turno dopo un viaggio con un oggetto si fanno solo interazioni`,
    });
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

/**
 * "Usa" (spec 047): a Senzu with nothing to recharge, as when it is bought
 * (D-015); a travel item taking the pawn beyond its reach, or past the
 * actions of the turn when it is the player's turn (D-013).
 */
function itemUseWarnings(
  state: GameState,
  action: Extract<GameAction, { type: 'useItem' }>,
  context: GameContext,
): Warning[] {
  const item = findItem(context.items, action.itemId);
  const player = state.players[action.player];
  const warnings: Warning[] = [];
  if (action.to === undefined) {
    if (rechargesStarter(item) && !rechargeablePower(state, action.player, action.powerId)) {
      warnings.push({
        kind: 'nothingToRecharge',
        message: `Lo starter di ${player.name} non ha poteri da ricaricare`,
      });
    }
    return warnings;
  }
  if (action.player === state.currentPlayer && state.actions.used >= state.actions.available) {
    warnings.push({
      kind: 'noActionsLeft',
      message: `${player.name} ha già usato tutte le azioni del turno`,
    });
  }
  if (player.noMovesTurn && action.player === state.currentPlayer) {
    warnings.push({
      kind: 'noMovesTurn',
      message: `${player.name} non può muoversi: nel turno dopo un viaggio con un oggetto si fanno solo interazioni`,
    });
  }
  if (action.to === state.players[opponentOf(action.player)].position) {
    warnings.push({
      kind: 'travelOnOpponent',
      message: `${item.name} non porta sulla casella di ${state.players[opponentOf(action.player)].name}`,
    });
  }
  const rule = travelRule(item);
  if (rule && action.to !== state.players[opponentOf(action.player)].position && !reachableCells(context.map, state, action.player, rule.steps).has(action.to)) {
    warnings.push({ kind: 'travelRange', message: `Casella fuori dalla portata della ${item.name}` });
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
  if (teamIsFull(buyer)) {
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

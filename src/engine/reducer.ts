import { EngineError } from './errors';
import {
  cellLabel,
  deepCopy,
  findCharacter,
  findEdge,
  findItem,
  findNode,
  findPower,
  opponentOf,
} from './lookup';
import {
  cellMission,
  missionLabel,
  noteTurnSkipped,
  notePawnMoved,
  rewardText,
} from './missions';
import { emptyOutput, notify, warn, type ActionOutput } from './output';
import { applyPower, firePowers } from './powers';
import { isRepeatInteraction, turnRuleWarnings } from './rules';
import { setCellContent } from './cells';
import { buyCharacter, buyItem } from './shop';
import { joinTeam, addToTeam, removeFromTeam } from './team';
import {
  BASE_ACTIONS,
  BASE_INTERACTIONS,
  PLAYER_IDS,
  type GameAction,
  type GameContext,
  type GameState,
  type PlayerId,
  type TurnActions,
} from './types';

export interface ActionResult extends ActionOutput {
  state: GameState;
}

/**
 * Applies one host action and returns the new state. The given state is
 * never modified: undo and the log rely on every past state staying intact.
 * Going past a limit never blocks the action; it adds a warning (D-008).
 */
export function applyAction(
  state: GameState,
  action: GameAction,
  context: GameContext,
): ActionResult {
  const draft = deepCopy(state);
  const out = emptyOutput();

  // Off-rule moves, interactions and purchases still happen, with a warning
  // given once per turn for each kind (D-013, D-014, D-015).
  for (const warning of turnRuleWarnings(state, action, context)) {
    out.warnings.push(warning);
    draft.acknowledgedThisTurn.push(warning.kind);
  }

  switch (action.type) {
    case 'move':
      findNode(context.map, action.to);
      movePawn(draft, draft.currentPlayer, action.to);
      draft.actions.used += 1;
      break;
    case 'interact':
      interact(draft, action.nodeId, context, out);
      break;
    case 'usePower':
      usePower(draft, action.player, action.powerId, out);
      break;
    case 'endTurn':
      endTurn(draft, out);
      break;
    case 'addCharacter':
      addToTeam(draft, context, action.player, action.characterId, out);
      break;
    case 'removeCharacter':
      removeFromTeam(draft, action.player, action.characterId, out);
      break;
    case 'setConquest':
      setConquest(draft, action.nodeId, action.player, context, out);
      break;
    case 'assign':
      assign(draft, action.nodeId, action.player, context, out);
      break;
    case 'setEdgeLock':
      setEdgeLock(draft, action.edgeId, action.players, action.locked, context);
      break;
    case 'buyCharacter':
      buyCharacter(draft, context, action.shopNodeId, action.characterId, out);
      break;
    case 'buyItem':
      buyItem(draft, context, action.shopNodeId, action.itemId, out);
      break;
    case 'setCoins':
      draft.players[action.player].coins = action.coins;
      break;
    case 'setTurn':
      draft.turn = action.turn;
      break;
    case 'setCurrentPlayer':
      draft.currentPlayer = action.player;
      // The interaction on record belonged to the previous player.
      draft.interactedNodeId = null;
      break;
    case 'setActions':
      draft.actions = mergeActions(draft.actions, action.actions);
      break;
    case 'setTurnsToSkip':
      draft.players[action.player].turnsToSkip = action.turns;
      break;
    case 'setPowerUses': {
      const power = findPower(draft.players[action.player], action.powerId);
      if (power.usesLeft === null) {
        throw new EngineError(`Power "${action.powerId}" is automatic and has no uses`);
      }
      power.usesLeft = action.uses;
      break;
    }
    case 'placePawn':
      findNode(context.map, action.nodeId);
      movePawn(draft, action.player, action.nodeId);
      break;
    case 'addToInventory':
      findItem(context.items, action.itemId);
      draft.players[action.player].inventory.push(action.itemId);
      break;
    case 'removeFromInventory': {
      const { inventory } = draft.players[action.player];
      const index = inventory.indexOf(action.itemId);
      if (index === -1) {
        throw new EngineError(`Item "${action.itemId}" is not in the inventory`);
      }
      inventory.splice(index, 1);
      break;
    }
    case 'setCharacterPrice':
      findCharacter(context.catalog, action.characterId);
      draft.characterPrices[action.characterId] = action.price;
      break;
    case 'setItemPrice':
      findItem(context.items, action.itemId);
      draft.itemPrices[action.itemId] = action.price;
      break;
    case 'setCellContent':
      setCellContent(draft, context, action.nodeId, action.content, out);
      break;
    case 'acceptMission':
      acceptMission(draft, action.nodeId, action.player, context, out);
      break;
    case 'completeMission':
      completeMission(draft, action.nodeId, action.player, context, out);
      break;
    case 'abandonMission':
      abandonMission(draft, action.missionId);
      break;
  }

  return { state: draft, ...out };
}

export function baseActions(): TurnActions {
  return {
    used: 0,
    available: BASE_ACTIONS,
    interactionsUsed: 0,
    interactionsAvailable: BASE_INTERACTIONS,
  };
}

/** Hands the turn to a player and fires their "at turn start" powers. */
export function startTurn(state: GameState, playerId: PlayerId, out: ActionOutput): void {
  state.currentPlayer = playerId;
  state.actions = baseActions();
  state.acknowledgedThisTurn = [];
  // A new turn on the same cell is a new interaction (spec 001, section 4).
  state.interactedNodeId = null;
  firePowers(state, playerId, (trigger) => trigger.type === 'turnStart', out);
}

function endTurn(state: GameState, out: ActionOutput): void {
  const endingId = state.currentPlayer;
  const ending = state.players[endingId];

  firePowers(state, endingId, (trigger) => trigger.type === 'turnEnd', out);
  ending.turnsPlayed += 1;
  firePowers(
    state,
    endingId,
    (trigger) => trigger.type === 'everyNTurns' && ending.turnsPlayed % trigger.n === 0,
    out,
  );

  // A skipped turn is lost entirely: no powers fire and it does not count
  // for "every N turns". It still uses up a turn number.
  let nextId = opponentOf(endingId);
  state.turn += 1;
  while (state.players[nextId].turnsToSkip > 0) {
    state.players[nextId].turnsToSkip -= 1;
    noteTurnSkipped(state, nextId);
    out.events.push(`Turno ${state.turn}: ${state.players[nextId].name} salta il turno`);
    state.turn += 1;
    nextId = opponentOf(nextId);
  }

  startTurn(state, nextId, out);
}

function interact(
  state: GameState,
  nodeId: string,
  context: GameContext,
  out: ActionOutput,
): void {
  // An already conquered cell is a turn-rule warning (D-014), given in applyAction.
  findNode(context.map, nodeId);
  if (isRepeatInteraction(state, nodeId)) {
    // Reopening the scene: no action, no interaction, no powers (spec 020, 2.4).
    return;
  }
  state.actions.used += 1;
  state.actions.interactionsUsed += 1;
  if (state.players[state.currentPlayer].position === nodeId) {
    state.interactedNodeId = nodeId;
  }

  firePowers(state, state.currentPlayer, (trigger) => trigger.type === 'interaction', out);
}

/** Puts a pawn on a cell. The current player leaving a cell can interact there again (spec 020). */
function movePawn(state: GameState, playerId: PlayerId, nodeId: string): void {
  const player = state.players[playerId];
  if (playerId === state.currentPlayer && player.position !== nodeId) {
    state.interactedNodeId = null;
  }
  player.position = nodeId;
  notePawnMoved(state, playerId, nodeId);
}

/**
 * "Assegna" (spec 020, 2.5): the character of the cell joins the player's
 * team and the cell is marked conquered by them, opening its paths
 * (D-027). One action, so one undo takes back both. A character already
 * in that team is not added twice; past limits only warn (D-008).
 */
function assign(
  state: GameState,
  nodeId: string,
  playerId: PlayerId,
  context: GameContext,
  out: ActionOutput,
): void {
  const characterId = state.cells[nodeId]?.characterId;
  if (characterId === undefined) {
    throw new EngineError(`Cell "${nodeId}" has no character to assign`);
  }
  const character = findCharacter(context.catalog, characterId);

  const conqueror = state.conquests[nodeId];
  if (conqueror !== undefined) {
    warn(
      out,
      'nodeAlreadyConquered',
      `${state.players[conqueror].name} aveva già conquistato ${character.name}`,
    );
  }
  joinTeam(state, context, playerId, characterId, out);
  setConquest(state, nodeId, playerId, context, out);
}

/**
 * "Accetta" in the scene (spec 026, 2.3): the mission joins the player's
 * missions in progress. "Salta turni" marks the turns to skip right away.
 */
function acceptMission(
  state: GameState,
  nodeId: string,
  playerId: PlayerId,
  context: GameContext,
  out: ActionOutput,
): void {
  findNode(context.map, nodeId);
  const mission = cellMission(state.cells[nodeId]);
  if (!mission) {
    throw new EngineError(`Cell "${nodeId}" has no mission`);
  }
  const player = state.players[playerId];
  const missions = (state.activeMissions ??= []);
  if (missions.some((active) => active.nodeId === nodeId && active.player === playerId)) {
    const giver = cellLabel(state, context.map, context.catalog, nodeId);
    warn(out, 'missionAlreadyActive', `${player.name} ha già in corso la missione di ${giver}`);
  }
  const id = state.nextMissionId ?? 1;
  state.nextMissionId = id + 1;
  const turns = Math.max(0, mission.turns ?? 0);
  missions.push({
    id,
    nodeId,
    player: playerId,
    turnsPlayedAtStart: player.turnsPlayed,
    ...(mission.type === 'skipTurns' ? { turnsToSkipLeft: turns } : {}),
  });
  if (mission.type === 'skipTurns' && turns > 0) {
    player.turnsToSkip += turns;
    out.events.push(`${player.name} salterà ${turns} ${turns === 1 ? 'turno' : 'turni'}`);
  }
}

/**
 * "Dai il premio", "Vinta", "Completata" (spec 026, 2.3 and 2.4): the
 * reward goes to the player and the cell is conquered by them, in one action
 * that one undo takes back. The mission leaves the missions in progress of
 * both players: whoever completes it first wins it.
 */
function completeMission(
  state: GameState,
  nodeId: string,
  playerId: PlayerId,
  context: GameContext,
  out: ActionOutput,
): void {
  findNode(context.map, nodeId);
  const content = state.cells[nodeId];
  const mission = cellMission(content);
  if (!mission) {
    throw new EngineError(`Cell "${nodeId}" has no mission`);
  }
  const player = state.players[playerId];
  const giver = cellLabel(state, context.map, context.catalog, nodeId);
  const conqueror = state.conquests[nodeId];
  if (conqueror !== undefined) {
    warn(
      out,
      'nodeAlreadyConquered',
      `${state.players[conqueror].name} aveva già completato la missione di ${giver}`,
    );
  }

  const { reward } = mission;
  const joining = [
    ...(reward.cellCharacter && content?.characterId ? [content.characterId] : []),
    ...(reward.characters ?? []),
  ];
  for (const characterId of joining) {
    joinTeam(state, context, playerId, characterId, out);
  }
  if (reward.coins) {
    player.coins += reward.coins;
  }
  for (const itemId of reward.items ?? []) {
    player.inventory.push(findItem(context.items, itemId).id);
  }

  // The other player loses the mission they had accepted (spec 026, 2.4).
  for (const active of state.activeMissions ?? []) {
    if (active.nodeId === nodeId && active.player !== playerId) {
      const loser = state.players[active.player].name;
      warn(
        out,
        'missionTaken',
        `Missione di ${giver} completata da ${player.name}: tolta dalle missioni in corso di ${loser}`,
      );
    }
  }
  state.activeMissions = (state.activeMissions ?? []).filter((active) => active.nodeId !== nodeId);

  const prize = rewardText(reward, content?.characterId, context.catalog, context.items);
  const label = missionLabel(mission, context.catalog);
  notify(state, out, `${player.name} · Missione completata: ${label}${prize ? ` → ${prize}` : ''}`);
  setConquest(state, nodeId, playerId, context, out);
}

/** "Abbandona" (spec 026, 2.4): the mission goes away without a reward. */
function abandonMission(state: GameState, missionId: number): void {
  const missions = state.activeMissions ?? [];
  const active = missions.find((candidate) => candidate.id === missionId);
  if (!active) {
    throw new EngineError(`Unknown mission "${missionId}"`);
  }
  // Turns still to skip for this mission are not skipped any more.
  const player = state.players[active.player];
  player.turnsToSkip = Math.max(0, player.turnsToSkip - (active.turnsToSkipLeft ?? 0));
  state.activeMissions = missions.filter((candidate) => candidate.id !== missionId);
}

function usePower(
  state: GameState,
  playerId: PlayerId,
  powerId: string,
  out: ActionOutput,
): void {
  const player = state.players[playerId];
  const power = findPower(player, powerId);

  if (power.usesLeft !== null) {
    if (power.usesLeft > 0) {
      power.usesLeft -= 1;
    } else {
      // Provisional rule (spec 001, section 5): the power fires anyway and
      // the uses stay at zero. To be reviewed power by power.
      warn(
        out,
        'powerOutOfUses',
        `${player.name} ha già usato tutti gli usi di ${power.definition.name}`,
      );
    }
  }

  applyPower(state, playerId, power, out);
}

/**
 * Marks a cell as conquered, or free again. Locked paths opened by this cell
 * (D-027) open for the new conqueror and close again for the previous one.
 */
function setConquest(
  state: GameState,
  nodeId: string,
  player: PlayerId | null,
  context: GameContext,
  out: ActionOutput,
): void {
  findNode(context.map, nodeId);
  const previous = state.conquests[nodeId] ?? null;
  if (player === null) {
    delete state.conquests[nodeId];
  } else {
    state.conquests[nodeId] = player;
  }
  if (previous === player) {
    return;
  }
  const label = (id: string) => cellLabel(state, context.map, context.catalog, id);
  for (const edge of context.map.edges) {
    const locks = state.edgeLocks[edge.id];
    if (!edge.locked || edge.unlockNodeId !== nodeId || !locks) {
      continue;
    }
    const path = `Percorso ${label(edge.from)} – ${label(edge.to)}`;
    if (previous !== null && !locks[previous]) {
      locks[previous] = true;
      out.events.push(`${path} richiuso per ${state.players[previous].name}`);
    }
    if (player !== null && locks[player]) {
      locks[player] = false;
      out.events.push(`${path} aperto per ${state.players[player].name}`);
    }
  }
}

function setEdgeLock(
  state: GameState,
  edgeId: string,
  players: PlayerId | 'both',
  locked: boolean,
  context: GameContext,
): void {
  const edge = findEdge(context.map, edgeId);
  const locks = state.edgeLocks[edge.id];
  if (!locks) {
    throw new EngineError(`Edge "${edgeId}" has no lock state`);
  }
  const targets = players === 'both' ? PLAYER_IDS : [players];
  for (const playerId of targets) {
    locks[playerId] = locked;
  }
}

function mergeActions(current: TurnActions, changes: Partial<TurnActions>): TurnActions {
  return {
    used: changes.used ?? current.used,
    available: changes.available ?? current.available,
    interactionsUsed: changes.interactionsUsed ?? current.interactionsUsed,
    interactionsAvailable: changes.interactionsAvailable ?? current.interactionsAvailable,
  };
}

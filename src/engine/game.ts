import { EngineError } from './errors';
import { deepCopy, findCharacter, findNode, opponentOf, validateCellContent } from './lookup';
import { emptyOutput } from './output';
import { firePowers } from './powers';
import { applyAction, baseActions, startTurn } from './reducer';
import {
  PLAYER_IDS,
  type Game,
  type GameAction,
  type GameSetup,
  type GameState,
  type HistoryEntry,
  type PlayerId,
  type PlayerSetup,
  type PlayerState,
  type Warning,
} from './types';

/**
 * "Inizia partita": prepares the game from map, chosen starters and start
 * cells, then fires the "at game start" powers of both players and the
 * "at turn start" powers of the first player.
 */
export function createGame(setup: GameSetup): Game {
  const map = deepCopy(setup.map);
  const catalog = deepCopy(setup.catalog);
  const items = deepCopy(setup.items);
  validateContent(setup);
  for (const playerId of PLAYER_IDS) {
    validatePlayerSetup(setup, setup.players[playerId]);
  }

  const state: GameState = {
    turn: 1,
    currentPlayer: setup.firstPlayer,
    actions: baseActions(),
    players: {
      p1: initialPlayer('p1', setup.players.p1, setup.startingCoins),
      p2: initialPlayer('p2', setup.players.p2, setup.startingCoins),
    },
    conquests: {},
    edgeLocks: Object.fromEntries(
      map.edges.map((edge) => [edge.id, { p1: edge.locked, p2: edge.locked }]),
    ),
    cells: deepCopy(setup.content),
    characterPrices: Object.fromEntries(
      Object.values(setup.content)
        .flatMap((content) => content.forSale ?? [])
        .map((characterId) => [characterId, findCharacter(catalog, characterId).price ?? 0]),
    ),
    itemPrices: Object.fromEntries(items.map((item) => [item.id, item.price])),
    soldCharacters: {},
    itemPurchases: [],
    acknowledgedThisTurn: [],
    notifications: [],
    nextNotificationId: 1,
  };

  const out = emptyOutput();
  for (const playerId of [setup.firstPlayer, opponentOf(setup.firstPlayer)]) {
    firePowers(state, playerId, (trigger) => trigger.type === 'gameStart', out);
  }
  startTurn(state, setup.firstPlayer, out);

  return {
    map,
    catalog,
    items,
    history: [
      {
        action: { type: 'startGame' },
        turn: state.turn,
        player: setup.firstPlayer,
        state,
        warnings: out.warnings,
        events: out.events,
      },
    ],
  };
}

export function currentState(game: Game): GameState {
  return lastEntry(game).state;
}

/** Applies a host action and records it in the history. */
export function act(game: Game, action: GameAction): Game {
  const before = currentState(game);
  const result = applyAction(before, action, game);
  const entry: HistoryEntry = {
    action,
    turn: before.turn,
    player: before.currentPlayer,
    state: result.state,
    warnings: result.warnings,
    events: result.events,
  };
  return { ...game, history: [...game.history, entry] };
}

/** Warnings produced by the last action, to show in the director window. */
export function lastWarnings(game: Game): Warning[] {
  return lastEntry(game).warnings;
}

export function canUndo(game: Game): boolean {
  return game.history.length > 1;
}

/** Goes back to the state before the last action. The start of the game cannot be undone. */
export function undo(game: Game): Game {
  if (!canUndo(game)) {
    return game;
  }
  return { ...game, history: game.history.slice(0, -1) };
}

/**
 * The cell the current player's pawn goes back to for free (D-087): where
 * its last move started, when that move is the last action of the turn.
 * Going back there undoes the move instead of making a new one. Null when
 * something else came after the move, or there is no move to go back on.
 */
export function stepBackCell(game: Game): string | null {
  const last = game.history[game.history.length - 1];
  const before = game.history[game.history.length - 2];
  if (!last || !before || last.action.type !== 'move') {
    return null;
  }
  const { turn, currentPlayer, players } = last.state;
  if (last.turn !== turn || last.player !== currentPlayer) {
    return null;
  }
  const from = before.state.players[currentPlayer].position;
  return from === players[currentPlayer].position ? null : from;
}

/**
 * A game with what "Ripeti" can bring back (spec 021): the history entries
 * taken away by undo, the last one undone at the end. It lives in the
 * director session only, never in the game nor in its saves.
 */
export interface Timeline {
  game: Game;
  redo: HistoryEntry[];
}

/** Undo that keeps the action taken away, for "Ripeti". */
export function undoKeepingRedo({ game, redo }: Timeline): Timeline {
  const last = game.history[game.history.length - 1];
  if (!canUndo(game) || !last) {
    return { game, redo };
  }
  return { game: undo(game), redo: [...redo, last] };
}

/** "Ripeti": brings back the last action undone, exactly as it was (D-009). */
export function redo({ game, redo: undone }: Timeline): Timeline {
  const entry = undone[undone.length - 1];
  if (!entry) {
    return { game, redo: undone };
  }
  return { game: { ...game, history: [...game.history, entry] }, redo: undone.slice(0, -1) };
}

/**
 * Closes a notification. This is not a game action: it is not logged and
 * cannot be undone. The notification is removed from every past state too,
 * so that undoing a later action does not bring it back on screen.
 */
export function dismissNotification(game: Game, notificationId: number): Game {
  return { ...game, history: withoutNotification(game.history, notificationId) };
}

/** The same for the actions "Ripeti" can bring back, so that they do not show it again. */
export function dismissRedoNotification(
  redo: HistoryEntry[],
  notificationId: number,
): HistoryEntry[] {
  return withoutNotification(redo, notificationId);
}

function withoutNotification(entries: HistoryEntry[], notificationId: number): HistoryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    state: {
      ...entry.state,
      notifications: entry.state.notifications.filter(
        (notification) => notification.id !== notificationId,
      ),
    },
  }));
}

function lastEntry(game: Game): HistoryEntry {
  const entry = game.history[game.history.length - 1];
  if (!entry) {
    throw new EngineError('The game history is empty');
  }
  return entry;
}

function initialPlayer(id: PlayerId, setup: PlayerSetup, startingCoins: number): PlayerState {
  return {
    name: setup.name,
    starterId: setup.starter.characterId,
    position: setup.startNodeId,
    coins: startingCoins,
    team: [setup.starter.characterId],
    powers: setup.starter.powers.map((definition, index) => ({
      id: `${id}-${index}`,
      definition: deepCopy(definition),
      usesLeft: definition.trigger.type === 'manual' ? definition.trigger.uses : null,
    })),
    inventory: [],
    turnsToSkip: 0,
    turnsPlayed: 0,
  };
}

/** Starting content must refer to existing cells and characters; only shops sell. */
function validateContent(setup: GameSetup): void {
  for (const [nodeId, content] of Object.entries(setup.content)) {
    validateCellContent(setup.map, setup.catalog, nodeId, content);
  }
}

function validatePlayerSetup(setup: GameSetup, player: PlayerSetup): void {
  findNode(setup.map, player.startNodeId);
  findCharacter(setup.catalog, player.starter.characterId);
  for (const power of player.starter.powers) {
    const { trigger } = power;
    if (trigger.type === 'everyNTurns' && !(Number.isInteger(trigger.n) && trigger.n >= 1)) {
      throw new EngineError(`Power "${power.name}": N must be a whole number of at least 1`);
    }
    if (trigger.type === 'manual' && !(Number.isInteger(trigger.uses) && trigger.uses >= 0)) {
      throw new EngineError(`Power "${power.name}": uses must be a whole number of at least 0`);
    }
  }
}

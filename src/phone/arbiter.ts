import type { FightRecord } from '../battle/fight';
import { proposedOutcome, teamChanges } from '../battle/inGame';
import { describeError } from '../describeError';
import {
  act,
  cellMission,
  characterPrice,
  currentState,
  isAdjacent,
  isRepeatInteraction,
  itemPrice,
  lastWarnings,
  missionsDone,
  stepBackCell,
  TEAM_SIZE,
  turnRuleWarnings,
  type Game,
  type GameAction,
  type GameState,
  type Mission,
  type PlayerId,
} from '../engine';

// The referee of the phone version (spec 052, 2.6; D-084): there is no host,
// so what the director only warns about is not done, and rewards and the
// outcomes of simulated fights apply by themselves.

/**
 * The cells the current player's pawn reaches with one tap (spec 052, 2.5):
 * next to it along paths open for them, while actions are left; and the
 * cell its last move started from, where going back undoes that move (D-087).
 */
export function moveTargets(game: Game, state: GameState): Set<string> {
  const back = stepBackCell(game);
  const targets = new Set<string>(back ? [back] : []);
  if (state.actions.used >= state.actions.available) {
    return targets;
  }
  const player = state.currentPlayer;
  const from = state.players[player].position;
  for (const edge of game.map.edges) {
    const other = edge.from === from ? edge.to : edge.to === from ? edge.from : null;
    if (other && isAdjacent(game.map, state, player, from, other)) {
      targets.add(other);
    }
  }
  return targets;
}

/**
 * Why the phone refuses an action, or null when it may be done: the turn
 * rules the director asks a second click for (D-013, D-015), coins that are
 * not enough, a full team, and whatever the engine would warn about.
 * Ending the turn with actions left is asked, not refused (spec 052, 2.8).
 */
export function blockReason(game: Game, action: GameAction): string | null {
  const state = currentState(game);
  const refused = (warning: { kind: string }) => warning.kind !== 'actionsLeft';
  const rule = turnRuleWarnings(state, action, game).find(refused);
  if (rule) {
    return rule.message;
  }
  const reason = missingCoins(game, state, action) ?? fullTeam(state, action);
  if (reason) {
    return reason;
  }
  let next: Game;
  try {
    next = act(game, action);
  } catch (cause) {
    return `Non si può fare: ${describeError(cause)}`;
  }
  return lastWarnings(next).find(refused)?.message ?? null;
}

function missingCoins(game: Game, state: GameState, action: GameAction): string | null {
  let price: number;
  if (action.type === 'buyCharacter') {
    const character = game.catalog.find((candidate) => candidate.id === action.characterId);
    price = character ? characterPrice(state, character) : 0;
  } else if (action.type === 'buyItem') {
    const item = game.items.find((candidate) => candidate.id === action.itemId);
    price = item ? itemPrice(state, item) : 0;
  } else {
    return null;
  }
  const buyer = state.players[state.currentPlayer];
  return price > buyer.coins
    ? `${buyer.name} ha ${buyer.coins} monete: ne servono ${price}`
    : null;
}

/**
 * A full team takes no more characters (format rules 6 and 8): the player
 * cannot open a character whose reward is a character.
 */
function fullTeam(state: GameState, action: GameAction): string | null {
  if (action.type !== 'interact' || isRepeatInteraction(state, action.nodeId)) {
    return null;
  }
  const player = state.players[state.currentPlayer];
  if (player.team.length < TEAM_SIZE || !givesCharacters(cellMission(state.cells[action.nodeId]))) {
    return null;
  }
  return `La squadra di ${player.name} è completa: non può prendere altri personaggi`;
}

/** Without a mission the character of the cell joins the team (spec 020). */
function givesCharacters(mission: Mission | undefined): boolean {
  if (!mission) {
    return true;
  }
  return Boolean(mission.reward.cellCharacter) || (mission.reward.characters?.length ?? 0) > 0;
}

/** The rewards of the missions whose condition came true: given at once (D-084, instead of D-040). */
export function rewardsDue(state: GameState): GameAction[] {
  return missionsDone(state).map((active) => ({
    type: 'completeMission',
    nodeId: active.nodeId,
    player: active.player,
  }));
}

/** The player's answer to a quiz: right gives the reward, wrong gives nothing (spec 052, 2.6). */
export function quizRewards(mission: Mission | undefined, answer: number, nodeId: string, player: PlayerId): GameAction[] {
  return mission?.type === 'quiz' && mission.quiz?.correct === answer
    ? [{ type: 'completeMission', nodeId, player }]
    : [];
}

/**
 * What a simulated fight of a mission does on the phone (spec 052, 2.7):
 * the reward when it is won (or the opponent transformed, for «costringimi
 * a trasformarmi»), and the player's characters that transformed stay so
 * (D-060), even after a lost fight.
 */
export function fightResults(
  record: FightRecord,
  mission: Mission | undefined,
  nodeId: string,
  player: PlayerId,
  team: readonly string[],
): GameAction[] {
  const actions: GameAction[] = [];
  if (proposedOutcome(record, mission) !== 'lost') {
    actions.push({ type: 'completeMission', nodeId, player });
  }
  const changes = teamChanges(record, team);
  if (changes.length > 0) {
    actions.push({ type: 'transformCharacters', player, changes });
  }
  return actions;
}

/**
 * The showdown opens by itself at the end of a turn with both pawns on one
 * cell (D-029) or with both teams full (spec 052, 2.9).
 */
export function phoneShowdownDue(state: GameState): boolean {
  const { p1, p2 } = state.players;
  return p1.position === p2.position || (p1.team.length >= TEAM_SIZE && p2.team.length >= TEAM_SIZE);
}

/** The winner of the showdown wins the game: side a is the first player (showdownSides). */
export function showdownWinner(record: FightRecord): PlayerId {
  return record.winner === 'a' ? 'p1' : 'p2';
}

/** What «Annulla» can take back on the phone (D-085): nothing that shows a mission or a result. */
const UNDOABLE: GameAction['type'][] = [
  'move',
  'buyCharacter',
  'buyItem',
  'useItem',
  'usePower',
  'useTraining',
  'acceptMission',
  'abandonMission',
];

/** True when the last action is one of the current player's in this turn that «Annulla» may take back. */
export function canUndoOnPhone(game: Game): boolean {
  const last = game.history[game.history.length - 1];
  if (game.history.length < 2 || !last) {
    return false;
  }
  const state = currentState(game);
  return (
    last.turn === state.turn &&
    last.player === state.currentPlayer &&
    (UNDOABLE as string[]).includes(last.action.type)
  );
}

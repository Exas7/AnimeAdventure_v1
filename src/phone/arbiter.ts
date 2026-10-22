import type { FightRecord } from '../battle/fight';
import { proposedOutcome, teamChanges } from '../battle/inGame';
import { describeError } from '../describeError';
import {
  act,
  cellMission,
  characterPrice,
  currentState,
  hasLostAt,
  isAdjacent,
  isRepeatInteraction,
  itemPrice,
  lastWarnings,
  missionsDone,
  rechargeablePower,
  rechargesStarter,
  stepBackCell,
  TEAM_SIZE,
  teamIsFull,
  turnRuleWarnings,
  type Game,
  type GameAction,
  type GameState,
  type Mission,
  type PlayerId,
  type PowerState,
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
 * cannot open a character whose reward is a character. Once per game a full
 * team may still take its sixth (spec 061, D-091).
 */
function fullTeam(state: GameState, action: GameAction): string | null {
  if (action.type !== 'interact' || isRepeatInteraction(state, action.nodeId)) {
    return null;
  }
  const player = state.players[state.currentPlayer];
  if (!teamIsFull(player) || !givesCharacters(cellMission(state.cells[action.nodeId]))) {
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

/**
 * The rewards of the missions whose condition came true: given at once
 * (D-084, instead of D-040). A full team after the sixth gets them without
 * the characters (spec 063, D-092).
 */
export function rewardsDue(state: GameState): GameAction[] {
  return missionsDone(state).map((active) => ({
    type: 'completeMission',
    nodeId: active.nodeId,
    player: active.player,
    ...(teamIsFull(state.players[active.player]) ? { withoutCharacters: true } : {}),
  }));
}

/**
 * The player's answer to a quiz: right gives the reward (spec 052, 2.6),
 * wrong is a lost challenge (spec 061, D-090).
 */
export function quizRewards(mission: Mission | undefined, answer: number, nodeId: string, player: PlayerId): GameAction[] {
  if (mission?.type !== 'quiz') {
    return [];
  }
  return mission.quiz?.correct === answer
    ? [{ type: 'completeMission', nodeId, player }]
    : [{ type: 'loseChallenge', nodeId, player }];
}

/**
 * What a simulated fight of a mission does on the phone (spec 052, 2.7):
 * the reward when it is won (or the opponent transformed, for «costringimi
 * a trasformarmi»), a lost challenge otherwise (spec 061, D-090), and the
 * player's characters that transformed stay so (D-060), even after a lost
 * fight.
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
  } else {
    actions.push({ type: 'loseChallenge', nodeId, player });
  }
  const changes = teamChanges(record, team);
  if (changes.length > 0) {
    actions.push({ type: 'transformCharacters', player, changes });
  }
  return actions;
}

/**
 * The showdown opens by itself at the end of a turn with both pawns on one
 * cell (D-029), or when both players made the swap of the sixth character
 * and have a full team (spec 052, 2.9; spec 061, D-091).
 */
export function phoneShowdownDue(state: GameState): boolean {
  const { p1, p2 } = state.players;
  const swapped = (player: typeof p1) => player.sixthTaken === true && player.team.length === TEAM_SIZE;
  return p1.position === p2.position || (swapped(p1) && swapped(p2));
}

/** Sent away after the sixth (spec 061, 2.3): anyone of the team but the starter. */
export function sendAwayChoices(state: GameState, player: PlayerId): string[] {
  const { team, starterId } = state.players[player];
  return team.filter((characterId) => characterId !== starterId);
}

/**
 * Challenging a character who beat the player (spec 061, 2.1; D-090): what
 * the phone says or offers. Null when the player did not lose there. With
 * the power «Ritenta una sfida persa», a window asks to use it, or a Senzu
 * when it has no uses left; `actions` go before the interaction.
 */
export type RetryChoice =
  | { kind: 'refused'; message: string }
  | { kind: 'offer'; message: string; actions: GameAction[] };

export const LOST_CHALLENGE_MESSAGE = 'Non puoi sfidare un PG che te le ha già suonate';

export function retryChoice(game: Game, nodeId: string): RetryChoice | null {
  const state = currentState(game);
  const playerId = state.currentPlayer;
  if (!hasLostAt(state, playerId, nodeId)) {
    return null;
  }
  const player = state.players[playerId];
  const power = retryPower(state, playerId);
  if (!power) {
    return { kind: 'refused', message: LOST_CHALLENGE_MESSAGE };
  }
  const name = power.definition.name;
  const senzu = player.inventory.find((itemId) => {
    const item = game.items.find((candidate) => candidate.id === itemId);
    return item !== undefined && rechargesStarter(item);
  });
  const usable = (power.usesLeft ?? 0) > 0;
  if (!usable && (!senzu || !rechargeablePower(state, playerId, power.id))) {
    return { kind: 'refused', message: `«${name}» ha finito gli usi: non puoi sfidare un PG che te le ha già suonate` };
  }
  if (state.actions.used >= state.actions.available) {
    return {
      kind: 'refused',
      message: `${player.name} ha già usato tutte le azioni del turno: potrà ritentare al prossimo turno`,
    };
  }
  const character = game.catalog.find((candidate) => candidate.id === state.cells[nodeId]?.characterId);
  const whom = character?.name ?? 'questo personaggio';
  const use: GameAction = { type: 'usePower', player: playerId, powerId: power.id };
  if (usable) {
    return {
      kind: 'offer',
      message: `Stai usando il potere dello starter «${name}» per sfidare di nuovo ${whom}.`,
      actions: [use],
    };
  }
  return {
    kind: 'offer',
    message: `«${name}» ha finito gli usi: puoi usare un Senzu per ricaricarlo e sfidare di nuovo ${whom}.`,
    actions: [{ type: 'useItem', player: playerId, itemId: senzu as string, powerId: power.id }, use],
  };
}

/** The player's power to retry a lost challenge, the first with uses left if there are more. */
function retryPower(state: GameState, playerId: PlayerId): PowerState | undefined {
  const powers = state.players[playerId].powers.filter(
    (power) => power.definition.effect.type === 'retryChallenge',
  );
  return powers.find((power) => (power.usesLeft ?? 0) > 0) ?? powers[0];
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

import { DEFAULT_SETTINGS, fighterOf, fightStats, recordFight, type Fighter, type FightRecord } from '../battle/fight';
import { charactersInGame, proposedMissionSides, showdownSides } from '../battle/inGame';
import { tierRank, type Random } from '../episode/fill';
import {
  awayCells,
  BASE_ACTIONS,
  cellMission,
  currentState,
  fusionOptions,
  hasLostAt,
  isAdjacent,
  isLottery,
  isOffCell,
  isRepeatInteraction,
  mustSendAway,
  nextForms,
  nodeOfCharacter,
  reachableCells,
  rechargeablePower,
  rechargesStarter,
  shopListing,
  TEAM_SIZE,
  teamIsFull,
  trainingRule,
  travelRule,
  type AiLevel,
  type Character,
  type Game,
  type GameAction,
  type GameState,
  type Mission,
  type MissionType,
  type PlayerId,
  type PlayerState,
  type PowerState,
  type TrainingChoice,
} from '../engine';
import { blockReason, cellRefusals } from '../phone/arbiter';
import type { StarterProposal } from '../starters/proposals';

// The AI opponent of the phone (spec 053, D-086). It plays with the same
// referee as the player: every step is an action the phone allows, and it
// asks the referee before choosing where to go (spec 093, D-109).

export interface LevelRules {
  /** How often the quiz answer is right. */
  quiz: number;
  /** How often Facile moves at random instead of towards something useful. */
  wander: number;
  /** Lasting missions it accepts (spec 053, 2.3). */
  lasting: MissionType[];
  /** How it decides whether to fight: any fight, by tier, or simulated. */
  fights: 'any' | 'tier' | 'simulate';
  /** The strongest purchase, or a random affordable character. */
  buysBest: boolean;
  /** Training items and manual powers. */
  usesItems: boolean;
  /** Chases or avoids the other pawn, by the strength of the teams. */
  showdown: boolean;
  /** Keeps where it is heading from one turn to the next (spec 093, 2.4). */
  keepsGoal: boolean;
  /** Leaves out the cells the opponent reaches first (spec 093, 2.6). */
  races: boolean;
  /** Buys and uses Nuvola Speedy and Trasmissione Istantanea (spec 093, 2.8; D-110). */
  travels: boolean;
  /** Takes its best order when the showdown opens (spec 093, 2.7; D-110). */
  ordersTeam: boolean;
}

export const LEVELS: Record<AiLevel, LevelRules> = {
  easy: {
    quiz: 0.5,
    wander: 0.6,
    lasting: ['goTo'],
    fights: 'any',
    buysBest: false,
    usesItems: false,
    showdown: false,
    keepsGoal: false,
    races: false,
    travels: false,
    ordersTeam: false,
  },
  normal: {
    quiz: 0.7,
    wander: 0,
    lasting: ['goTo', 'defeat', 'bring', 'escort'],
    fights: 'tier',
    buysBest: true,
    usesItems: true,
    showdown: false,
    keepsGoal: true,
    races: false,
    travels: false,
    ordersTeam: false,
  },
  hard: {
    quiz: 0.9,
    wander: 0,
    lasting: ['goTo', 'defeat', 'bring', 'escort'],
    fights: 'simulate',
    buysBest: true,
    usesItems: true,
    showdown: true,
    keepsGoal: true,
    races: true,
    travels: true,
    ordersTeam: true,
  },
};

export const LEVEL_NAMES: Record<AiLevel, string> = { easy: 'Facile', normal: 'Normale', hard: 'Difficile' };

/** Simulated fights for a chance (Difficile): enough to tell a good fight from a bad one. */
export const SIMULATIONS = 40;
/** Below this chance Difficile does not fight. */
export const HARD_MIN_CHANCE = 0.45;
/** A goal is kept unless another place is worth this much more (spec 093, 2.4). */
export const KEEP_GOAL = 1.5;
/** What a cell the opponent reaches first is still worth, as a share (spec 093, 2.6). */
export const RACE_LOST = 0.25;
/** A trip goes to a cell at least this many paths away on foot (spec 093, 2.8). */
export const TRIP_MIN = 4;
/** The actions a trip costs in all: the trip, the meeting, and the moves of the next turn (D-108). */
export const TRIP_COST = 4;
/** A trip is bought for a cell at least this many paths away from the shop (spec 093, 2.8). */
export const TRIP_BUY_MIN = 5;
/** Wins out of SIMULATIONS a new showdown order needs over the one the team has (spec 093, 2.7). */
export const ORDER_MARGIN = 2;
/** Random orders tried in the showdown, besides those by tier. */
const RANDOM_ORDERS = 6;
/** What reaching the opponent is worth when the AI chases (spec 061, 2.4). */
const CHASE_VALUE = 4000;
/** The goal of a chase, which moves with the opponent. */
const CHASE = 'chase';
/** Estimates kept at most; past this the memory starts again (spec 093, 2.4). */
const MAX_CHANCES = 2000;

/** One step of the AI's turn, shown to the player one after the other (spec 053, 2.2). */
export type AiStep =
  /**
   * An action of the game; `shop` while buying, to show the shop; `reopens`
   * a cell to deal with again: the AI retries its lost challenge (spec 063).
   */
  | { kind: 'act'; action: GameAction; text: string; resolves?: string; shop?: string; reopens?: string }
  /** The interaction with the character where the pawn stands: the scene opens. */
  | { kind: 'interact'; nodeId: string; text: string }
  | { kind: 'quiz'; nodeId: string; answer: number; text: string; resolves: string }
  | { kind: 'fight'; nodeId: string; fighters: string[]; text: string; resolves: string }
  /** The scene closes with nothing done (a mission it does not take). */
  | { kind: 'close'; resolves: string }
  | { kind: 'end'; text: string };

/** What the AI remembers. */
export interface AiMemory {
  /** Scenes and shops already dealt with in this turn. */
  resolved: Set<string>;
  /**
   * Chances from the simulator, by the fighters of both sides: kept from one
   * turn to the next, so the same teams give the same answer (spec 093, 2.4).
   */
  chances: Map<string, number>;
  /** Where it is heading, kept between turns (spec 093, 2.4): a cell, or the chase. */
  goal: string | null;
  /**
   * The referee's answers about the cells (D-109), good while only moves
   * happen: `since` is the last other action in the history.
   */
  refusals: { since: number; answers: Map<string, string[]> };
}

export function newMemory(): AiMemory {
  return { resolved: new Set(), chances: new Map(), goal: null, refusals: { since: -1, answers: new Map() } };
}

/**
 * The memory for the AI's next turn (spec 093, 2.4): its estimates and its
 * goal stay, the scenes it dealt with go.
 */
export function nextTurnMemory(memory: AiMemory): AiMemory {
  const chances = memory.chances.size > MAX_CHANCES ? new Map<string, number>() : memory.chances;
  return { ...newMemory(), chances, goal: memory.goal };
}

/** What a character is worth to the AI: its price, or its tier when it has none. */
export function characterValue(character: Character | undefined): number {
  if (!character) {
    return 0;
  }
  const rank = tierRank(character.tier) ?? 0;
  return Math.max(character.price ?? 0, 200 + rank * 150);
}

function rank(game: Game, id: string): number {
  return tierRank(game.catalog.find((character) => character.id === id)?.tier) ?? 0;
}

const opponentOf = (player: PlayerId): PlayerId => (player === 'p1' ? 'p2' : 'p1');

/** The starter the AI chooses among its proposals (spec 053, 2.1). */
export function aiStarterIndex(
  proposals: readonly StarterProposal[],
  catalog: readonly Character[],
  level: AiLevel,
  random: Random,
): number {
  const filled = proposals.flatMap((proposal, index) => (proposal.characterId ? [index] : []));
  if (filled.length === 0) {
    return 0;
  }
  if (!LEVELS[level].buysBest) {
    return filled[Math.floor(random() * filled.length)] ?? 0;
  }
  const rankOf = (index: number) =>
    tierRank(catalog.find((character) => character.id === proposals[index]?.characterId)?.tier) ?? -1;
  return filled.reduce((best, index) => (rankOf(index) > rankOf(best) ? index : best));
}

/**
 * Steps along the player's open paths from a cell (their pawn by default),
 * with the first step towards each cell and the cell before it on the way.
 */
function paths(
  game: Game,
  state: GameState,
  player: PlayerId,
  start: string = state.players[player].position,
): { distance: Map<string, number>; first: Map<string, string>; previous: Map<string, string> } {
  const neighbours = new Map<string, string[]>();
  for (const edge of game.map.edges) {
    if (isAdjacent(game.map, state, player, edge.from, edge.to)) {
      neighbours.set(edge.from, [...(neighbours.get(edge.from) ?? []), edge.to]);
      neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from]);
    }
  }
  const distance = new Map<string, number>([[start, 0]]);
  const first = new Map<string, string>();
  const previous = new Map<string, string>();
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index] as string;
    for (const next of neighbours.get(node) ?? []) {
      if (!distance.has(next)) {
        distance.set(next, (distance.get(node) ?? 0) + 1);
        first.set(next, node === start ? next : (first.get(node) as string));
        previous.set(next, node);
        queue.push(next);
      }
    }
  }
  return { distance, first, previous };
}

/**
 * What the referee would refuse about an action on a cell, the turn's
 * actions and interactions left out (spec 093, 2.1; D-109). The answers are
 * remembered while only moves happen, which do not change them.
 */
function refusedHere(game: Game, memory: AiMemory, action: GameAction, key: string): string[] {
  let since = game.history.length - 1;
  while (since > 0 && game.history[since]?.action.type === 'move') {
    since -= 1;
  }
  if (memory.refusals.since !== since) {
    memory.refusals = { since, answers: new Map() };
  }
  let kinds = memory.refusals.answers.get(key);
  if (!kinds) {
    kinds = cellRefusals(game, action);
    memory.refusals.answers.set(key, kinds);
  }
  return kinds;
}

/**
 * Whether the referee would let the AI meet the character of a cell (spec
 * 093, 2.1). A challenge it lost counts only with «Ritenta» to use (spec
 * 061, 2.4; spec 063, 2.4), and only at the levels that use powers.
 */
function canMeet(game: Game, state: GameState, nodeId: string, level: AiLevel, memory: AiMemory): boolean {
  // A cell it already met where it stands opens the scene again, with no rules: not the same answer.
  const repeat = isRepeatInteraction(state, nodeId);
  const kinds = refusedHere(game, memory, { type: 'interact', nodeId }, `interact:${nodeId}:${repeat}`);
  const retry = LEVELS[level].usesItems && usablePower(state, state.currentPlayer, 'retryChallenge') !== undefined;
  return kinds.every((kind) => kind === 'challengeLost' && retry);
}

function rewardValue(game: Game, mission: Mission, cellCharacter: string | undefined): number {
  const find = (id: string | undefined) => game.catalog.find((character) => character.id === id);
  const { reward } = mission;
  const items = (reward.items ?? []).reduce(
    (sum, id) => sum + (game.items.find((item) => item.id === id)?.price ?? 0),
    0,
  );
  const characters = (reward.characters ?? []).reduce((sum, id) => sum + characterValue(find(id)), 0);
  return (reward.cellCharacter ? characterValue(find(cellCharacter)) : 0) + characters + (reward.coins ?? 0) + items;
}

/** How often the AI answers a quiz right: a lottery is luck for anyone (spec 074, 2.4; D-099). */
function quizChance(mission: Mission, level: AiLevel): number {
  return isLottery(mission.quiz) ? 1 / (mission.quiz?.answers.length ?? 1) : LEVELS[level].quiz;
}

function givesCharacters(mission: Mission | undefined): boolean {
  return !mission || Boolean(mission.reward.cellCharacter) || (mission.reward.characters?.length ?? 0) > 0;
}

/** The AI's characters that can fight, strongest first. */
function myFighters(game: Game, state: GameState, player: PlayerId): string[] {
  const blocked = charactersInGame(state);
  return state.players[player].team
    .filter((id) => {
      const character = game.catalog.find((candidate) => candidate.id === id);
      return character !== undefined && fighterOf(character, game.catalog, blocked) !== null;
    })
    .sort((a, b) => rank(game, b) - rank(game, a));
}

function toFighters(game: Game, state: GameState, ids: readonly string[]): Fighter[] {
  const blocked = charactersInGame(state);
  return ids.flatMap((id) => {
    const character = game.catalog.find((candidate) => candidate.id === id);
    const fighter = character ? fighterOf(character, game.catalog, blocked) : null;
    return fighter ? [fighter] : [];
  });
}

/** Who the AI sends on the field for a fight mission (spec 053, 2.3). */
export function chooseFighters(game: Game, state: GameState, nodeId: string, level: AiLevel, random: Random): string[] {
  const player = state.currentPlayer;
  const size = proposedMissionSides(state, nodeId, player, game.catalog).a.length;
  const candidates = myFighters(game, state, player);
  if (LEVELS[level].fights === 'any') {
    // Facile sends whoever happens to be there.
    const shuffled = [...candidates];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other] as string, shuffled[index] as string];
    }
    return shuffled.slice(0, size);
  }
  return candidates.slice(0, size);
}

/** The fight of a mission, already decided: what the phone shows and applies (spec 053, 2.2). */
export function aiFight(
  game: Game,
  state: GameState,
  nodeId: string,
  fighters: readonly string[],
  random: Random,
): { record: FightRecord; team: string[] } {
  const opponents = proposedMissionSides(state, nodeId, state.currentPlayer, game.catalog).b;
  const record = recordFight(
    { a: toFighters(game, state, fighters), b: toFighters(game, state, opponents) },
    DEFAULT_SETTINGS,
    random,
  );
  return { record, team: [...state.players[state.currentPlayer].team] };
}

/** How likely the AI is to win the fight of a cell; 0 when it would not fight it. */
function fightChance(game: Game, state: GameState, nodeId: string, level: AiLevel, memory: AiMemory, random: Random): number {
  const fighters = chooseFighters(game, state, nodeId, level, random);
  if (fighters.length === 0) {
    return 0;
  }
  const opponents = proposedMissionSides(state, nodeId, state.currentPlayer, game.catalog).b;
  const rules = LEVELS[level];
  if (rules.fights === 'any') {
    return 0.5;
  }
  if (rules.fights === 'tier') {
    const average = (ids: readonly string[]) => ids.reduce((sum, id) => sum + rank(game, id), 0) / Math.max(1, ids.length);
    const difference = average(fighters) - average(opponents);
    // Fewer fighters than opponents (a 2v2 with one character) weighs on the chance.
    const outnumbered = Math.min(1, fighters.length / Math.max(1, opponents.length));
    return difference < 0 ? 0 : Math.min(0.9, 0.55 + 0.05 * difference) * outnumbered;
  }
  // The same fighters on both sides give the same answer, turn after turn (spec 093, 2.4).
  const key = `fight:${nodeId}:${fighters.join(',')}|${opponents.join(',')}`;
  const known = memory.chances.get(key);
  if (known !== undefined) {
    return known;
  }
  const stats = fightStats(
    { a: toFighters(game, state, fighters), b: toFighters(game, state, opponents) },
    DEFAULT_SETTINGS,
    SIMULATIONS,
    random,
  );
  const chance = stats.wins.a / SIMULATIONS;
  const kept = chance < HARD_MIN_CHANCE ? 0 : chance;
  memory.chances.set(key, kept);
  return kept;
}

/**
 * What interacting with a character cell is worth to the AI now; 0 when it
 * would not, or the referee would not let it (spec 093, 2.1). `nested`:
 * asked for another mission, where a mission that lasts counts nothing.
 */
function cellValue(
  game: Game,
  state: GameState,
  nodeId: string,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
  nested = false,
): number {
  const player = state.currentPlayer;
  const content = state.cells[nodeId];
  const node = game.map.nodes.find((candidate) => candidate.id === nodeId);
  if (!content?.characterId || node?.type === 'shop') {
    return 0;
  }
  const accepted = (state.activeMissions ?? []).some((active) => active.nodeId === nodeId && active.player === player);
  if (accepted || !canMeet(game, state, nodeId, level, memory)) {
    return 0;
  }
  const mission = cellMission(content);
  if (!mission) {
    return characterValue(game.catalog.find((character) => character.id === content.characterId));
  }
  const reward = rewardValue(game, mission, content.characterId);
  switch (mission.type) {
    case 'fight':
      return reward * fightChance(game, state, nodeId, level, memory, random);
    case 'quiz':
      return reward * quizChance(mission, level);
    case 'other':
    case 'skipTurns':
    case 'wait':
    case 'comeBack':
      return 0;
    default:
      return !nested && LEVELS[level].lasting.includes(mission.type)
        ? lastingValue(game, state, nodeId, mission, level, memory, random)
        : 0;
  }
}

/**
 * A mission that lasts, for its giver's cell (spec 093, 2.5): half its
 * reward when the referee lets the AI accept it and it can finish it; all
 * of it when it is done at once; nothing when it cannot be finished.
 */
function lastingValue(
  game: Game,
  state: GameState,
  nodeId: string,
  mission: Mission,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
): number {
  const accept: GameAction = { type: 'acceptMission', nodeId, player: state.currentPlayer };
  if (refusedHere(game, memory, accept, `accept:${nodeId}`).length > 0) {
    return 0;
  }
  const reward = rewardValue(game, mission, state.cells[nodeId]?.characterId);
  switch (missionProgress(game, state, nodeId, mission, level, memory, random)) {
    case 'done':
      return reward;
    case 'possible':
      return reward * 0.5;
    case 'impossible':
      return 0;
  }
}

/** Whether the AI can finish a mission that lasts, given from a cell (spec 093, 2.5). */
function missionProgress(
  game: Game,
  state: GameState,
  giverNode: string,
  mission: Mission,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
): 'done' | 'possible' | 'impossible' {
  const player = state.currentPlayer;
  const target = mission.targetId;
  if (!target) {
    return 'impossible';
  }
  const reach = paths(game, state, player, giverNode).distance;
  const node = nodeOfCharacter(state, target);
  switch (mission.type) {
    case 'goTo':
    case 'escort':
      return node !== undefined && reach.has(node) ? 'possible' : 'impossible';
    case 'defeat':
      if (node === undefined) {
        return 'impossible';
      }
      if (state.conquests[node] === player) {
        return 'done';
      }
      return reach.has(node) && cellValue(game, state, node, level, memory, random, true) > 0 ? 'possible' : 'impossible';
    case 'bring':
      if (state.players[player].team.includes(target)) {
        return 'done';
      }
      return bringSources(game, state, target, level, memory, random).some((source) => reach.has(source))
        ? 'possible'
        : 'impossible';
    default:
      return 'impossible';
  }
}

/**
 * Where the AI can take a character into its team (spec 093, 2.5): a cell
 * whose reward is that character, or a shop that sells it to the AI now.
 */
function bringSources(
  game: Game,
  state: GameState,
  characterId: string,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
): string[] {
  const sources: string[] = [];
  for (const node of game.map.nodes) {
    const cell = state.cells[node.id];
    if (!cell) {
      continue;
    }
    if (node.type === 'shop') {
      const sells = shopListing(state, game, node.id, state.currentPlayer).characters.some(
        (entry) => entry.characterId === characterId,
      );
      const buy: GameAction = { type: 'buyCharacter', shopNodeId: node.id, characterId };
      if (sells && refusedHere(game, memory, buy, `buy:${node.id}:${characterId}`).length === 0) {
        sources.push(node.id);
      }
      continue;
    }
    const mission = cellMission(cell);
    const gives =
      cell.characterId === characterId
        ? !mission || Boolean(mission.reward.cellCharacter)
        : (mission?.reward.characters ?? []).includes(characterId);
    if (gives && cellValue(game, state, node.id, level, memory, random, true) > 0) {
      sources.push(node.id);
    }
  }
  return sources;
}

/** The reward of the AI's «Porta» missions that a character in its team would complete (spec 093, 2.5). */
function bringReward(game: Game, state: GameState, characterId: string): number {
  const player = state.currentPlayer;
  return (state.activeMissions ?? [])
    .filter((active) => active.player === player)
    .reduce((sum, active) => {
      const mission = cellMission(state.cells[active.nodeId]);
      return mission?.type === 'bring' && mission.targetId === characterId
        ? sum + rewardValue(game, mission, state.cells[active.nodeId]?.characterId)
        : sum;
    }, 0);
}

/** True when the AI already carries Nuvola Speedy or Trasmissione Istantanea. */
function holdsTrip(game: Game, state: GameState, player: PlayerId): boolean {
  return state.players[player].inventory.some((itemId) => {
    const item = game.items.find((candidate) => candidate.id === itemId);
    return item !== undefined && travelRule(item) !== undefined;
  });
}

/**
 * The best thing the AI can buy in a shop, if any (spec 053, 2.3). `inShop`:
 * the pawn is there, and Difficile may buy a trip (spec 093, 2.8).
 */
function purchase(
  game: Game,
  state: GameState,
  shopId: string,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
  inShop: boolean,
): { action: GameAction; name: string; value: number } | null {
  const player = state.currentPlayer;
  const coins = state.players[player].coins;
  const listing = shopListing(state, game, shopId, player);
  const options: { action: GameAction; name: string; value: number }[] = [];
  if (!teamIsFull(state.players[player])) {
    for (const entry of listing.characters) {
      if (entry.soldTo === null && entry.price <= coins) {
        const character = game.catalog.find((candidate) => candidate.id === entry.characterId);
        options.push({
          action: { type: 'buyCharacter', shopNodeId: shopId, characterId: entry.characterId },
          name: entry.name,
          // A «Porta» in progress makes the character worth its reward too (spec 093, 2.5).
          value: characterValue(character) + bringReward(game, state, entry.characterId),
        });
      }
    }
  }
  if (LEVELS[level].usesItems) {
    for (const entry of listing.items) {
      const item = game.items.find((candidate) => candidate.id === entry.itemId);
      const usable = item && trainingRule(item) && trainingPlan(game, state, player, item.id).length > 0;
      if (usable && !entry.soldOut && !entry.alreadyBought && entry.price <= coins) {
        options.push({
          action: { type: 'buyItem', shopNodeId: shopId, itemId: entry.itemId },
          name: entry.name,
          value: entry.price * 0.8,
        });
      }
      // A Senzu that recharges something worth it (spec 063, 2.4).
      const recharge = item && rechargesStarter(item) ? rechargeValue(state, player) : 0;
      if (recharge > entry.price && !entry.soldOut && entry.price <= coins) {
        options.push({
          action: { type: 'buyItem', shopNodeId: shopId, itemId: entry.itemId },
          name: entry.name,
          value: recharge,
        });
      }
    }
  }
  if (LEVELS[level].travels && inShop && !holdsTrip(game, state, player)) {
    for (const entry of listing.items) {
      const item = game.items.find((candidate) => candidate.id === entry.itemId);
      const rule = item ? travelRule(item) : undefined;
      if (rule && !entry.soldOut && entry.price <= coins) {
        const gain = tripGain(game, state, rule.steps, level, memory, random) - entry.price;
        if (gain > 0) {
          options.push({ action: { type: 'buyItem', shopNodeId: shopId, itemId: entry.itemId }, name: entry.name, value: gain });
        }
      }
    }
  }
  const allowed = options.filter((option) => blockReason(game, option.action) === null);
  if (allowed.length === 0) {
    return null;
  }
  if (!LEVELS[level].buysBest) {
    return allowed[Math.floor(random() * allowed.length)] ?? null;
  }
  return allowed.reduce((best, option) => (option.value > best.value ? option : best));
}

/**
 * What a trip bought here would give (spec 093, 2.8): the most valuable
 * cell within its reach that is at least TRIP_BUY_MIN paths away on foot,
 * and while it chases one worth the detour (spec 094); 0 when there is none.
 */
function tripGain(game: Game, state: GameState, steps: number | null, level: AiLevel, memory: AiMemory, random: Random): number {
  const player = state.currentPlayer;
  const { distance } = paths(game, state, player);
  const stops = chaseStops(game, state, level, memory, random);
  let best = 0;
  for (const node of reachableCells(game.map, state, player, steps)) {
    const pays = stops === null || stops(cellMission(state.cells[node]), state.cells[node]?.characterId);
    if ((distance.get(node) ?? Infinity) >= TRIP_BUY_MIN && pays) {
      best = Math.max(best, cellValue(game, state, node, level, memory, random));
    }
  }
  return best;
}

/**
 * How the AI uses a training item: the strongest characters go up as many
 * forms as the item allows, never into a form already in the game (D-064).
 */
export function trainingPlan(game: Game, state: GameState, player: PlayerId, itemId: string): TrainingChoice[] {
  const item = game.items.find((candidate) => candidate.id === itemId);
  const rule = item ? trainingRule(item) : undefined;
  if (!rule) {
    return [];
  }
  const blocked = charactersInGame(state);
  const choices: TrainingChoice[] = [];
  let left = rule.formsTotal;
  const team = [...state.players[player].team].sort((a, b) => rank(game, b) - rank(game, a));
  for (const id of team) {
    if (choices.length >= rule.characters || left <= 0) {
      break;
    }
    const forms = nextForms(game.catalog, id, rule.formsEach);
    let free = 0;
    while (free < forms.length && !blocked.has(forms[free] as string)) {
      free += 1;
    }
    const climb = Math.min(free, rule.formsEach, left);
    if (climb > 0) {
      choices.push({ characterId: id, forms: climb });
      left -= climb;
    }
  }
  return choices;
}

/** Wins of a player's side in SIMULATIONS showdowns with these two lines. */
function showdownWins(game: Game, state: GameState, player: PlayerId, mine: readonly string[], theirs: readonly string[], random: Random): number {
  const own = toFighters(game, state, mine);
  const other = toFighters(game, state, theirs);
  const stats = fightStats(player === 'p1' ? { a: own, b: other } : { a: other, b: own }, DEFAULT_SETTINGS, SIMULATIONS, random);
  return player === 'p1' ? stats.wins.a : stats.wins.b;
}

/**
 * The chance of the AI in the showdown, its team as side b when it is
 * player 2. The same teams give the same answer (spec 093, 2.4).
 */
function showdownChance(game: Game, state: GameState, player: PlayerId, memory: AiMemory, random: Random): number {
  const sides = showdownSides(state);
  const key = `showdown:${player}:${sides.a.join(',')}|${sides.b.join(',')}`;
  const known = memory.chances.get(key);
  if (known !== undefined) {
    return known;
  }
  if (toFighters(game, state, sides.a).length === 0 || toFighters(game, state, sides.b).length === 0) {
    return 0.5;
  }
  const mine = player === 'p1' ? sides.a : sides.b;
  const theirs = player === 'p1' ? sides.b : sides.a;
  const chance = showdownWins(game, state, player, mine, theirs, random) / SIMULATIONS;
  memory.chances.set(key, chance);
  return chance;
}

/**
 * The order the AI Difficile takes when the showdown opens (spec 093, 2.7;
 * D-110): its team as it is, by tier both ways and a few random orders,
 * each tried with the simulator against the opponent's order now. Null
 * when the team keeps its order.
 */
export function aiShowdownOrder(game: Game, player: PlayerId, random: Random): string[] | null {
  const state = currentState(game);
  const team = state.players[player].team;
  const theirs = state.players[opponentOf(player)].team.slice(0, TEAM_SIZE);
  if (team.length < 2 || toFighters(game, state, theirs).length === 0) {
    return null;
  }
  const byTier = [...team].sort((a, b) => rank(game, b) - rank(game, a));
  const candidates = [byTier, [...byTier].reverse()];
  for (let count = 0; count < RANDOM_ORDERS; count += 1) {
    const shuffled = [...team];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other] as string, shuffled[index] as string];
    }
    candidates.push(shuffled);
  }
  const wins = (order: readonly string[]) => showdownWins(game, state, player, order.slice(0, TEAM_SIZE), theirs, random);
  const seen = new Set([team.join(',')]);
  let best: string[] | null = null;
  let bestWins = wins(team) + ORDER_MARGIN;
  for (const order of candidates) {
    if (seen.has(order.join(','))) {
      continue;
    }
    seen.add(order.join(','));
    const result = wins(order);
    if (result > bestWins) {
      best = order;
      bestWins = result;
    }
  }
  return best;
}

/** The places to swap, one after the other, to put a team in an order (spec 093, 2.7). */
export function swapsTo(team: readonly string[], order: readonly string[]): { a: number; b: number }[] {
  const now = [...team];
  const swaps: { a: number; b: number }[] = [];
  order.forEach((id, index) => {
    const from = now.indexOf(id);
    if (from > index) {
      swaps.push({ a: index, b: from });
      [now[index], now[from]] = [now[from] as string, now[index] as string];
    }
  });
  return swaps;
}

function nameAt(game: Game, state: GameState, nodeId: string): string {
  const id = state.cells[nodeId]?.characterId;
  return game.catalog.find((character) => character.id === id)?.name ?? `casella ${nodeId}`;
}

/** The next step of the AI's turn (spec 053, 2.2-2.3). The current player must be the AI. */
export function nextAiStep(game: Game, level: AiLevel, random: Random, memory: AiMemory): AiStep {
  const state = currentState(game);
  const player = state.currentPlayer;
  const me = state.players[player];
  const rules = LEVELS[level];
  const position = me.position;
  const actionsLeft = state.actions.available - state.actions.used;
  const interactionsLeft = state.actions.interactionsAvailable - state.actions.interactionsUsed;
  const allowed = (action: GameAction) => blockReason(game, action) === null;

  // After the sixth it sends away its weakest character, never the starter (spec 061, 2.4).
  if (mustSendAway(me)) {
    const weakest = me.team
      .filter((id) => id !== me.starterId)
      .map((id) => game.catalog.find((character) => character.id === id))
      .filter((character): character is Character => character !== undefined)
      .sort((a, b) => characterValue(a) - characterValue(b))[0];
    if (weakest) {
      return {
        kind: 'act',
        action: { type: 'removeCharacter', player, characterId: weakest.id },
        text: `Lascia ${weakest.name}: esce dalla partita`,
      };
    }
  }

  // It fuses whenever it can, into the strongest fusion (spec 068, 2.4).
  const fusion = fusionOptions(state, game.catalog, player)
    .map((option) => ({ option, result: game.catalog.find((character) => character.id === option.resultId) }))
    .sort((a, b) => characterValue(b.result) - characterValue(a.result))[0];
  if (fusion?.result) {
    const action: GameAction = { type: 'fuse', player, members: fusion.option.members, resultId: fusion.result.id };
    if (allowed(action)) {
      return { kind: 'act', action, text: `Fonde la coppia in ${fusion.result.name}` };
    }
  }

  if (rules.usesItems) {
    // Manual powers: coins at once; the others when they pay (spec 063, 2.4).
    for (const power of me.powers) {
      const { effect } = power.definition;
      const action: GameAction = { type: 'usePower', player, powerId: power.id };
      const now =
        effect.type === 'addCoins' ||
        (effect.type === 'skipOpponentTurn' && skipWorthIt(game, state, player, level, memory, random));
      if (now && (power.usesLeft ?? 0) > 0 && allowed(action)) {
        return { kind: 'act', action, text: `Usa il potere «${power.definition.name}»` };
      }
    }
    // Training items: on the strongest characters.
    for (const itemId of new Set(me.inventory)) {
      const choices = trainingPlan(game, state, player, itemId);
      const action: GameAction = { type: 'useTraining', player, itemId, choices };
      if (choices.length > 0 && allowed(action)) {
        const name = game.items.find((item) => item.id === itemId)?.name ?? itemId;
        return { kind: 'act', action, text: `Usa ${name}` };
      }
    }
  }

  // In a shop: entering costs nothing (spec 002, section 4).
  const here = game.map.nodes.find((node) => node.id === position);
  if (here?.type === 'shop' && !memory.resolved.has(`shop:${position}`)) {
    const best = purchase(game, state, position, level, memory, random, true);
    if (best) {
      return {
        kind: 'act',
        action: best.action,
        text: `Compra ${best.name}`,
        shop: position,
        resolves: rules.buysBest ? undefined : `shop:${position}`,
      };
    }
  }

  // The scene of the character it just interacted with.
  const cellKey = `cell:${position}`;
  if (state.interactedNodeId === position && !memory.resolved.has(cellKey) && state.cells[position]?.characterId) {
    const mission = cellMission(state.cells[position]);
    const name = nameAt(game, state, position);
    if (state.conquests[position] !== undefined) {
      return { kind: 'close', resolves: cellKey };
    }
    if (!mission) {
      const action: GameAction = { type: 'assign', nodeId: position, player };
      return allowed(action)
        ? { kind: 'act', action, text: `Prende ${name} in squadra`, resolves: cellKey }
        : { kind: 'close', resolves: cellKey };
    }
    if (mission.type === 'quiz' && mission.quiz) {
      const right = random() < quizChance(mission, level);
      const wrong = mission.quiz.answers.map((_, index) => index).filter((index) => index !== mission.quiz?.correct);
      const answer = right || wrong.length === 0 ? mission.quiz.correct : (wrong[Math.floor(random() * wrong.length)] as number);
      return { kind: 'quiz', nodeId: position, answer, text: `Risponde al quiz di ${name}`, resolves: cellKey };
    }
    if (mission.type === 'fight') {
      const fighters = chooseFighters(game, state, position, level, random);
      return fighters.length > 0
        ? { kind: 'fight', nodeId: position, fighters, text: `Combatte contro ${name}`, resolves: cellKey }
        : { kind: 'close', resolves: cellKey };
    }
    if (rules.lasting.includes(mission.type)) {
      const action: GameAction = { type: 'acceptMission', nodeId: position, player };
      if (allowed(action)) {
        return { kind: 'act', action, text: `Accetta la missione di ${name}`, resolves: cellKey };
      }
    }
    return { kind: 'close', resolves: cellKey };
  }

  // While it chases, only a reward worth the detour stops it; on the opponent's cell it is already there (spec 094).
  const stopPays = () => {
    const stops = position === state.players[opponentOf(player)].position ? null : chaseStops(game, state, level, memory, random);
    return stops === null || stops(cellMission(state.cells[position]), state.cells[position]?.characterId);
  };

  // Retry a lost challenge where it stands, when the character is worth it (spec 063, 2.4).
  const retry = usablePower(state, player, 'retryChallenge');
  if (
    retry &&
    rules.usesItems &&
    actionsLeft > 0 &&
    hasLostAt(state, player, position) &&
    cellValue(game, state, position, level, memory, random) > 0 &&
    stopPays()
  ) {
    const action: GameAction = { type: 'usePower', player, powerId: retry.id };
    if (allowed(action)) {
      return {
        kind: 'act',
        action,
        text: `Usa «${retry.definition.name}» per sfidare di nuovo ${nameAt(game, state, position)}`,
        reopens: cellKey,
      };
    }
  }

  // Interact with the character where it stands, when it is worth it.
  if (
    actionsLeft > 0 &&
    interactionsLeft > 0 &&
    !isRepeatInteraction(state, position) &&
    !memory.resolved.has(cellKey) &&
    cellValue(game, state, position, level, memory, random) > 0 &&
    stopPays() &&
    allowed({ type: 'interact', nodeId: position })
  ) {
    return { kind: 'interact', nodeId: position, text: `Incontra ${nameAt(game, state, position)}` };
  }

  // Extra actions when they take it to its goal in this turn (spec 063, 2.4),
  // and with «Doppia azione» to a second interaction too (spec 067, 2.3).
  const extra = usablePower(state, player, 'extraActions');
  const effect = extra?.definition.effect;
  const extraActions = effect?.type === 'extraActions' ? effect.amount : 0;
  const extraInteractions = effect?.type === 'extraActions' ? (effect.interactions ?? 0) : 0;
  if (actionsLeft > 0 || extraInteractions > 0) {
    const ranked = rankTargets(game, state, level, memory, random);
    // A trip to a far cell, when walking there costs more (spec 093, 2.8).
    const trip = rules.travels && actionsLeft >= 2 && interactionsLeft > 0 ? chooseTrip(game, state, ranked) : null;
    if (trip) {
      return {
        kind: 'act',
        action: { type: 'useItem', player, itemId: trip.itemId, to: trip.to },
        text: `Usa ${trip.name}: va da ${nameAt(game, state, trip.to)}`,
      };
    }
    const move = chooseMove(game, state, level, memory, random, ranked);
    if (move) {
      const needed = move.distance + (move.interact ? 1 : 0);
      const noInteraction = move.interact && interactionsLeft <= 0;
      if (
        extra &&
        rules.usesItems &&
        (needed > actionsLeft || noInteraction) &&
        needed <= actionsLeft + extraActions &&
        (!noInteraction || extraInteractions > 0)
      ) {
        const action: GameAction = { type: 'usePower', player, powerId: extra.id };
        if (allowed(action)) {
          return { kind: 'act', action, text: `Usa il potere «${extra.definition.name}» per arrivare prima` };
        }
      }
      if (actionsLeft > 0 && move.to !== null) {
        return { kind: 'act', action: { type: 'move', to: move.to }, text: move.text };
      }
    }
  }
  return { kind: 'end', text: 'Finisce il turno' };
}

/** A manual power of the player with this effect and uses left. */
function usablePower(state: GameState, player: PlayerId, effect: string): PowerState | undefined {
  return state.players[player].powers.find(
    (power) => power.definition.effect.type === effect && (power.usesLeft ?? 0) > 0,
  );
}

/**
 * What a Senzu is worth to the AI (spec 063, 2.4): the extra starting coins
 * paid again, or a use back for a manual power that has none left.
 */
function rechargeValue(state: GameState, player: PlayerId): number {
  const power = rechargeablePower(state, player);
  if (!power) {
    return 0;
  }
  const { effect } = power.definition;
  if (power.usesLeft === null) {
    return effect.type === 'addCoins' ? effect.amount : 0;
  }
  return power.usesLeft === 0 ? 600 : 0;
}

/** From this turn on the AI uses «Salta turno» anyway: the game is near its end. */
export const LATE_TURN = 40;

/**
 * «Fai saltare un turno» when it slows the opponent at the right time (spec
 * 063, 2.4): their team is about to be complete, or they are close and would
 * win the showdown (Difficile), or the game is late.
 */
function skipWorthIt(game: Game, state: GameState, player: PlayerId, level: AiLevel, memory: AiMemory, random: Random): boolean {
  const other = opponentOf(player);
  const mine = state.players[player].team.length;
  const theirs = state.players[other].team.length;
  if (state.players[other].turnsToSkip > 0) {
    return false;
  }
  if (theirs >= TEAM_SIZE - 1 && theirs >= mine) {
    return true;
  }
  if (state.turn >= LATE_TURN) {
    return true;
  }
  if (LEVELS[level].showdown) {
    const near = (paths(game, state, other).distance.get(state.players[player].position) ?? Infinity) <= 3;
    return near && showdownChance(game, state, player, memory, random) <= 0.4;
  }
  return false;
}

/** Characters ahead of the player that make the AI chase them (spec 061, 2.4). */
export const CHASE_LEAD = 3;

/**
 * Chasing for the showdown pays only with a clear lead: 3 characters more,
 * or a team already finished with the swap of the sixth (spec 061, 2.4).
 * Before that the AI keeps gathering characters.
 */
export function chaseWorthIt(state: GameState, player: PlayerId, other: PlayerId): boolean {
  const me = state.players[player];
  const finished = me.team.length >= TEAM_SIZE && me.sixthTaken === true;
  return finished || me.team.length - state.players[other].team.length >= CHASE_LEAD;
}

/** Whether the AI chases the opponent: it would win the showdown, with a clear lead (spec 061, 2.4). */
function chases(game: Game, state: GameState, level: AiLevel, memory: AiMemory, random: Random): boolean {
  const player = state.currentPlayer;
  return (
    LEVELS[level].showdown &&
    state.players[player].team.length > 0 &&
    showdownChance(game, state, player, memory, random) >= 0.6 &&
    chaseWorthIt(state, player, opponentOf(player))
  );
}

/** The lowest tier of an SS (spec 094). */
const SS_RANK = tierRank('SS-') as number;

const isSS = (game: Game, characterId: string | undefined) =>
  characterId !== undefined && rank(game, characterId) >= SS_RANK;

/** Whether a stop pays: the reward of a mission and the character of its cell, or with no mission that character. */
type StopPays = (mission: Mission | undefined, characterId: string | undefined) => boolean;

/**
 * What still stops the AI on the way while it chases (spec 094): with its
 * team finished nothing; before, a reward with an SS, or coins enough to
 * buy the cheapest SS on sale on the map. Null when it does not chase, or
 * cannot reach the opponent: then any stop may pay.
 */
function chaseStops(game: Game, state: GameState, level: AiLevel, memory: AiMemory, random: Random): StopPays | null {
  const player = state.currentPlayer;
  const other = state.players[opponentOf(player)].position;
  if (!chases(game, state, level, memory, random) || !paths(game, state, player).distance.has(other)) {
    return null;
  }
  if (teamIsFull(state.players[player])) {
    return () => false;
  }
  let cheapest = Infinity;
  for (const node of game.map.nodes) {
    if (node.type !== 'shop') {
      continue;
    }
    for (const entry of shopListing(state, game, node.id, player).characters) {
      if (entry.soldTo === null && isSS(game, entry.characterId)) {
        cheapest = Math.min(cheapest, entry.price);
      }
    }
  }
  return (mission, characterId) =>
    mission === undefined
      ? isSS(game, characterId)
      : (Boolean(mission.reward.cellCharacter) && isSS(game, characterId)) ||
        (mission.reward.characters ?? []).some((id) => isSS(game, id)) ||
        (mission.reward.coins ?? 0) >= cheapest;
}

/** A place the AI may head for. */
interface Target {
  node: string;
  /** What it is worth there, after the race with the opponent (spec 093, 2.6). */
  value: number;
  /** What it is worth there with no race: arriving at once by a trip. */
  full: number;
  text: string;
  /** Once there it still needs an action to meet the character. */
  interact: boolean;
  /** What it keeps from one turn to the next (spec 093, 2.4). */
  goal: string;
}

/** The places worth heading for, from where the pawn stands, and what to keep away from. */
interface Ranking {
  targets: Target[];
  /** The opponent's cell when the showdown would be lost. */
  avoid: string | null;
  /** On the opponent's cell, chasing: it stays for the showdown (spec 093, 2.3). */
  caught: boolean;
  distance: Map<string, number>;
  first: Map<string, string>;
}

/**
 * Whether the opponent gets to a cell first (spec 093, 2.6): the AI plays
 * now with the actions it has left, the opponent after it; meeting the
 * character takes an action more. With no interaction left the AI meets
 * no one before its next turn.
 */
function opponentFirst(mine: number, theirs: number, actionsLeft: number, meetsNow: boolean): boolean {
  const myTurns = meetsNow
    ? mine + 1 <= actionsLeft
      ? 1
      : 1 + Math.ceil((mine + 1 - actionsLeft) / BASE_ACTIONS)
    : 1 + Math.ceil((Math.max(0, mine - actionsLeft) + 1) / BASE_ACTIONS);
  return Math.ceil((theirs + 1) / BASE_ACTIONS) < myTurns;
}

/**
 * A guess at whether the opponent would take a cell (spec 093, 2.6): not
 * where they lost, not a character when their team is full. Only a guess
 * at their wishes: what the AI may do itself the referee says.
 */
function opponentWants(state: GameState, other: PlayerId, nodeId: string): boolean {
  const mission = cellMission(state.cells[nodeId]);
  return !hasLostAt(state, other, nodeId) && !(givesCharacters(mission) && teamIsFull(state.players[other]));
}

/** Where a player stood when their last turn began; undefined before they played one (spec 094, 2.8). */
function lastTurnStart(game: Game, player: PlayerId): string | undefined {
  let index = game.history.length - 1;
  while (index >= 0 && game.history[index]?.player !== player) {
    index -= 1;
  }
  while (index > 0 && game.history[index - 1]?.player === player) {
    index -= 1;
  }
  // The state before their first action: at the start of the game, the start itself.
  return index < 0 ? undefined : game.history[Math.max(0, index - 1)]?.state.players[player].position;
}

/**
 * A guess at the cell the opponent heads for (spec 094, 2.8): the one worth
 * most to them for the paths, as the AI weighs its own, among those they
 * got closer to in their last turn. Only what the map shows: the
 * characters they may still meet, the goals of their missions. Null when
 * they did not move, or got closer to no cell worth anything to them.
 */
function opponentGoal(game: Game, state: GameState, other: PlayerId, theirs: Map<string, number>): string | null {
  const position = state.players[other].position;
  const before = lastTurnStart(game, other);
  if (before === undefined || before === position) {
    return null;
  }
  const since = paths(game, state, other, before).distance;
  const worth = new Map<string, number>();
  const away = awayCells(state);
  for (const node of game.map.nodes) {
    const content = state.cells[node.id];
    const accepted = (state.activeMissions ?? []).some((active) => active.nodeId === node.id && active.player === other);
    if (
      node.type === 'shop' ||
      !content?.characterId ||
      state.conquests[node.id] !== undefined ||
      away.has(node.id) ||
      isOffCell(state, node.id) ||
      accepted ||
      !opponentWants(state, other, node.id)
    ) {
      continue;
    }
    const mission = cellMission(content);
    const character = game.catalog.find((candidate) => candidate.id === content.characterId);
    worth.set(node.id, mission ? rewardValue(game, mission, content.characterId) : characterValue(character));
  }
  for (const active of state.activeMissions ?? []) {
    const mission = cellMission(state.cells[active.nodeId]);
    if (active.player !== other || !mission?.targetId || !['goTo', 'escort', 'defeat'].includes(mission.type)) {
      continue;
    }
    const node = active.reachedTarget && mission.returnToGiver ? active.nodeId : nodeOfCharacter(state, mission.targetId);
    if (node !== undefined) {
      const reward = rewardValue(game, mission, state.cells[active.nodeId]?.characterId);
      worth.set(node, Math.max(worth.get(node) ?? 0, reward));
    }
  }
  let goal: string | null = null;
  let best = 0;
  for (const [node, value] of worth) {
    if (value <= 0 || !theirs.has(node) || (theirs.get(node) ?? Infinity) >= (since.get(node) ?? Infinity)) {
      continue;
    }
    const score = value / ((theirs.get(node) ?? Infinity) + 1);
    if (score > best) {
      best = score;
      goal = node;
    }
  }
  return goal;
}

/** Turns in which a pawn does not move: skipped, or the one after a trip. */
const stillTurns = (player: PlayerState) => player.turnsToSkip + (player.noMovesNext ? 1 : 0);

/**
 * Where the AI meets the opponent it chases (spec 094, 2.8): the first cell
 * of their way to their goal where they end a turn and it gets in time;
 * their goal when it gets to none; where they stand when they go nowhere.
 * Moving BASE_ACTIONS paths a turn, the AI and the opponent turn by turn.
 */
function cutOff(game: Game, state: GameState, mine: Map<string, number>, actionsLeft: number): string {
  const me = state.players[state.currentPlayer];
  const other = opponentOf(state.currentPlayer);
  const them = state.players[other];
  const { distance, previous } = paths(game, state, other);
  const goal = opponentGoal(game, state, other, distance);
  if (goal === null || !mine.has(them.position)) {
    return them.position;
  }
  const way = [goal];
  for (let cell = previous.get(goal); cell !== undefined; cell = previous.get(cell)) {
    way.unshift(cell);
  }
  const now = me.noMovesTurn ? 0 : actionsLeft;
  const arrival = stillTurns(them) + Math.ceil((way.length - 1) / BASE_ACTIONS);
  for (let turn = 0; turn <= arrival; turn += 1) {
    const cell = way[Math.min(way.length - 1, Math.max(0, turn - stillTurns(them)) * BASE_ACTIONS)] as string;
    if ((mine.get(cell) ?? Infinity) <= now + Math.max(0, turn - stillTurns(me)) * BASE_ACTIONS) {
      return cell;
    }
  }
  return mine.has(goal) ? goal : them.position;
}

/** The places the AI may head for, with their value (spec 053, 2.3; spec 093). */
function rankTargets(game: Game, state: GameState, level: AiLevel, memory: AiMemory, random: Random): Ranking {
  const player = state.currentPlayer;
  const other = opponentOf(player);
  const rules = LEVELS[level];
  const { distance, first } = paths(game, state, player);
  const position = state.players[player].position;
  const otherPosition = state.players[other].position;
  const actionsLeft = state.actions.available - state.actions.used;
  const interactionsLeft = state.actions.interactionsAvailable - state.actions.interactionsUsed;
  const theirs = rules.races ? paths(game, state, other).distance : null;
  const ranking: Ranking = { targets: [], avoid: null, caught: false, distance, first };
  const add = (node: string, value: number, text: string, interact: boolean, goal = node) => {
    const raced =
      theirs !== null &&
      interact &&
      node !== position &&
      opponentWants(state, other, node) &&
      opponentFirst(distance.get(node) ?? Infinity, theirs.get(node) ?? Infinity, actionsLeft, interactionsLeft > 0);
    ranking.targets.push({ node, value: raced ? value * RACE_LOST : value, full: value, text, interact, goal });
  };

  if (chases(game, state, level, memory, random)) {
    ranking.caught = otherPosition === position;
    // Where they are going, not where they stand (spec 094, 2.8).
    const meet = ranking.caught ? position : cutOff(game, state, distance, actionsLeft);
    // Weighed as before, by the paths to where they stand: the stops of spec 094 (2.2) do not change.
    const value = (CHASE_VALUE * ((distance.get(meet) ?? 0) + 1)) / ((distance.get(otherPosition) ?? 0) + 1);
    const name = state.players[other].name;
    add(meet, value, meet === otherPosition ? `Insegue ${name}` : `Taglia la strada a ${name}`, false, CHASE);
  } else if (
    rules.showdown &&
    state.players[player].team.length > 0 &&
    showdownChance(game, state, player, memory, random) <= 0.4
  ) {
    ranking.avoid = otherPosition;
  }
  // While it chases, only a reward worth the detour (spec 094).
  const stops = chaseStops(game, state, level, memory, random);
  const pays = (mission: Mission | undefined, characterId: string | undefined) =>
    stops === null || stops(mission, characterId);
  const cellPays = (nodeId: string) => pays(cellMission(state.cells[nodeId]), state.cells[nodeId]?.characterId);

  for (const node of game.map.nodes) {
    if (!distance.has(node.id)) {
      continue;
    }
    if (node.id === position) {
      // Where it stands, worth meeting but not in this turn: it may wait there (spec 093, 2.2).
      const later =
        interactionsLeft <= 0 && !isRepeatInteraction(state, position) && !memory.resolved.has(`cell:${position}`)
          ? cellValue(game, state, position, level, memory, random)
          : 0;
      if (later > 0 && cellPays(position)) {
        add(position, later, `Resta da ${nameAt(game, state, position)}`, true);
      }
      continue;
    }
    if (node.type === 'shop') {
      const best = purchase(game, state, node.id, level, memory, random, false);
      const bought = best?.action.type === 'buyCharacter' ? best.action.characterId : undefined;
      if (best && pays(undefined, bought)) {
        add(node.id, best.value * 0.8, 'Va verso il negozio', false);
      }
      continue;
    }
    const value = cellValue(game, state, node.id, level, memory, random);
    if (value > 0 && cellPays(node.id)) {
      add(node.id, value, `Va verso ${nameAt(game, state, node.id)}`, true);
    }
  }

  // The places its accepted missions ask for (spec 053, 2.3; spec 093, 2.5).
  for (const active of state.activeMissions ?? []) {
    if (active.player !== player) {
      continue;
    }
    const mission = cellMission(state.cells[active.nodeId]);
    if (!mission?.targetId) {
      continue;
    }
    const giver = state.cells[active.nodeId]?.characterId;
    const reward = rewardValue(game, mission, giver);
    const rewardPays = pays(mission, giver);
    const targetNode = nodeOfCharacter(state, mission.targetId);
    if (mission.type === 'goTo' || mission.type === 'escort') {
      const node = active.reachedTarget && mission.returnToGiver ? active.nodeId : targetNode;
      if (node !== undefined && node !== position && distance.has(node) && rewardPays) {
        add(node, reward, `Va verso ${nameAt(game, state, node)} per la missione`, false);
      }
    } else if (mission.type === 'defeat') {
      const value = targetNode !== undefined && targetNode !== position ? cellValue(game, state, targetNode, level, memory, random) : 0;
      if (targetNode !== undefined && value > 0 && distance.has(targetNode) && (rewardPays || cellPays(targetNode))) {
        add(targetNode, value + reward, `Va a battere ${nameAt(game, state, targetNode)} per la missione`, true);
      }
    } else if (mission.type === 'bring') {
      for (const source of bringSources(game, state, mission.targetId, level, memory, random)) {
        if (source === position || !distance.has(source)) {
          continue;
        }
        const shop = game.map.nodes.find((node) => node.id === source)?.type === 'shop';
        if (!rewardPays && !pays(undefined, mission.targetId) && (shop || !cellPays(source))) {
          continue;
        }
        const value = shop ? 0 : cellValue(game, state, source, level, memory, random);
        add(source, value + reward, 'Va a prendere chi serve per la missione', !shop);
      }
    }
  }
  return ranking;
}

/** Where the pawn goes next: one step towards the most convenient place, or nowhere (`to` null) to wait where it is. */
function chooseMove(
  game: Game,
  state: GameState,
  level: AiLevel,
  memory: AiMemory,
  random: Random,
  ranking: Ranking,
): { to: string | null; text: string; distance: number; interact: boolean } | null {
  const player = state.currentPlayer;
  const rules = LEVELS[level];
  const position = state.players[player].position;
  const { targets, avoid, distance, first } = ranking;
  if (ranking.caught) {
    // On the opponent's cell: the showdown opens at the end of the turn (spec 093, 2.3).
    memory.goal = CHASE;
    return null;
  }
  const neighbours = [...first.entries()].filter(([node]) => distance.get(node) === 1).map(([node]) => node);
  const legal = (to: string) => blockReason(game, { type: 'move', to }) === null;
  const steps = neighbours.filter((node) => node !== avoid && legal(node));
  const wander = random() < rules.wander || targets.length === 0;
  if (wander) {
    if (steps.length === 0 || (rules.wander === 0 && targets.length === 0)) {
      return null;
    }
    const to = steps[Math.floor(random() * steps.length)] as string;
    return { to, text: 'Si sposta', distance: 1, interact: false };
  }
  // Facile goes to the nearest useful cell; the others weigh the reward against the distance.
  const score = (target: Target) =>
    rules.buysBest
      ? target.value / ((distance.get(target.node) ?? 1) + 1)
      : -(distance.get(target.node) ?? Infinity);
  const ordered = [...targets].sort((a, b) => score(b) - score(a));
  // The goal of the turns before stays first, unless another place is worth clearly more (spec 093, 2.4).
  const kept = rules.keepsGoal ? ordered.find((target) => target.goal === memory.goal) : undefined;
  const best = ordered[0];
  if (kept && best && score(kept) * KEEP_GOAL >= score(best)) {
    ordered.splice(ordered.indexOf(kept), 1);
    ordered.unshift(kept);
  }
  for (const target of ordered) {
    if (target.node === position) {
      // It waits there: for the character, or for the opponent on their way (spec 094, 2.8).
      memory.goal = target.goal;
      return { to: null, text: target.text, distance: 0, interact: target.interact };
    }
    const step = first.get(target.node);
    if (step && steps.includes(step)) {
      memory.goal = target.goal;
      return { to: step, text: target.text, distance: distance.get(target.node) ?? 1, interact: target.interact };
    }
  }
  return null;
}

/**
 * A trip with an item it carries (spec 093, 2.8): to the cell worth most
 * among those at least TRIP_MIN paths away on foot and within the item's
 * reach, when it beats every place the AI can walk to. The referee checks
 * the reach and the opponent's cell (D-108).
 */
function chooseTrip(game: Game, state: GameState, ranking: Ranking): { itemId: string; name: string; to: string } | null {
  const player = state.currentPlayer;
  const me = state.players[player];
  if (me.noMovesTurn || ranking.caught) {
    return null;
  }
  const walk = (target: Target) => target.value / ((ranking.distance.get(target.node) ?? Infinity) + 1);
  const bestWalk = Math.max(0, ...ranking.targets.map(walk));
  let best: { itemId: string; name: string; to: string; score: number } | null = null;
  for (const itemId of new Set(me.inventory)) {
    const item = game.items.find((candidate) => candidate.id === itemId);
    if (!item || !travelRule(item)) {
      continue;
    }
    for (const target of ranking.targets) {
      const score = target.full / TRIP_COST;
      if (
        !target.interact ||
        (ranking.distance.get(target.node) ?? Infinity) < TRIP_MIN ||
        score <= bestWalk ||
        score <= (best?.score ?? 0) ||
        blockReason(game, { type: 'useItem', player, itemId, to: target.node }) !== null
      ) {
        continue;
      }
      best = { itemId, name: item.name, to: target.node, score };
    }
  }
  return best;
}

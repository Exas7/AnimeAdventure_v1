import { DEFAULT_SETTINGS, fighterOf, fightStats, recordFight, type Fighter, type FightRecord } from '../battle/fight';
import { charactersInGame, proposedMissionSides, showdownSides } from '../battle/inGame';
import { tierRank, type Random } from '../episode/fill';
import {
  cellMission,
  currentState,
  hasLostAt,
  isAdjacent,
  isRepeatInteraction,
  mustSendAway,
  nextForms,
  shopListing,
  TEAM_SIZE,
  teamIsFull,
  trainingRule,
  type AiLevel,
  type Character,
  type Game,
  type GameAction,
  type GameState,
  type Mission,
  type MissionType,
  type PlayerId,
  type TrainingChoice,
} from '../engine';
import { blockReason } from '../phone/arbiter';
import type { StarterProposal } from '../starters/proposals';

// The AI opponent of the phone (spec 053, D-086). It plays with the same
// referee as the player: every step is an action the phone allows.

interface LevelRules {
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
}

export const LEVELS: Record<AiLevel, LevelRules> = {
  easy: { quiz: 0.5, wander: 0.6, lasting: ['wait', 'goTo'], fights: 'any', buysBest: false, usesItems: false, showdown: false },
  normal: { quiz: 0.7, wander: 0, lasting: ['goTo', 'defeat', 'bring', 'wait'], fights: 'tier', buysBest: true, usesItems: true, showdown: false },
  hard: { quiz: 0.9, wander: 0, lasting: ['goTo', 'defeat', 'bring', 'wait'], fights: 'simulate', buysBest: true, usesItems: true, showdown: true },
};

export const LEVEL_NAMES: Record<AiLevel, string> = { easy: 'Facile', normal: 'Normale', hard: 'Difficile' };

/** Simulated fights for a chance (Difficile): enough to tell a good fight from a bad one. */
const SIMULATIONS = 40;
/** Below this chance Difficile does not fight. */
const HARD_MIN_CHANCE = 0.45;

/** One step of the AI's turn, shown to the player one after the other (spec 053, 2.2). */
export type AiStep =
  /** An action of the game; `shop` while buying, to show the shop. */
  | { kind: 'act'; action: GameAction; text: string; resolves?: string; shop?: string }
  /** The interaction with the character where the pawn stands: the scene opens. */
  | { kind: 'interact'; nodeId: string; text: string }
  | { kind: 'quiz'; nodeId: string; answer: number; text: string; resolves: string }
  | { kind: 'fight'; nodeId: string; fighters: string[]; text: string; resolves: string }
  /** The scene closes with nothing done (a mission it does not take). */
  | { kind: 'close'; resolves: string }
  | { kind: 'end'; text: string };

/** What the AI remembers during one of its turns. */
export interface AiMemory {
  /** Scenes and shops already dealt with in this turn. */
  resolved: Set<string>;
  /** Fight chances already simulated in this turn, by cell; 'showdown' for the showdown. */
  chances: Map<string, number>;
}

export function newMemory(): AiMemory {
  return { resolved: new Set(), chances: new Map() };
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

/** Steps along open paths from the pawn, with the first step towards each cell. */
function paths(game: Game, state: GameState, player: PlayerId): { distance: Map<string, number>; first: Map<string, string> } {
  const start = state.players[player].position;
  const neighbours = new Map<string, string[]>();
  for (const edge of game.map.edges) {
    if (isAdjacent(game.map, state, player, edge.from, edge.to)) {
      neighbours.set(edge.from, [...(neighbours.get(edge.from) ?? []), edge.to]);
      neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from]);
    }
  }
  const distance = new Map<string, number>([[start, 0]]);
  const first = new Map<string, string>();
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index] as string;
    for (const next of neighbours.get(node) ?? []) {
      if (!distance.has(next)) {
        distance.set(next, (distance.get(node) ?? 0) + 1);
        first.set(next, node === start ? next : (first.get(node) as string));
        queue.push(next);
      }
    }
  }
  return { distance, first };
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
  const size = proposedMissionSides(state, nodeId, player, game.catalog, random).a.length;
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
  const opponents = proposedMissionSides(state, nodeId, state.currentPlayer, game.catalog, random).b;
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
  const opponents = proposedMissionSides(state, nodeId, state.currentPlayer, game.catalog, random).b;
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
  const known = memory.chances.get(nodeId);
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
  memory.chances.set(nodeId, kept);
  return kept;
}

/** What interacting with a character cell is worth to the AI now; 0 when it would not. */
function cellValue(game: Game, state: GameState, nodeId: string, level: AiLevel, memory: AiMemory, random: Random): number {
  const player = state.currentPlayer;
  const content = state.cells[nodeId];
  const node = game.map.nodes.find((candidate) => candidate.id === nodeId);
  if (!content?.characterId || node?.type === 'shop' || state.conquests[nodeId] !== undefined) {
    return 0;
  }
  // A character who beat it: the AI does not retry (spec 061, 2.4).
  if (hasLostAt(state, player, nodeId)) {
    return 0;
  }
  const mission = cellMission(content);
  const accepted = (state.activeMissions ?? []).some((active) => active.nodeId === nodeId && active.player === player);
  // A full team still takes its sixth, once (spec 061, D-091).
  if (accepted || (givesCharacters(mission) && teamIsFull(state.players[player]))) {
    return 0;
  }
  if (!mission) {
    return characterValue(game.catalog.find((character) => character.id === content.characterId));
  }
  const reward = rewardValue(game, mission, content.characterId);
  switch (mission.type) {
    case 'fight':
      return reward * fightChance(game, state, nodeId, level, memory, random);
    case 'quiz':
      return reward * LEVELS[level].quiz;
    case 'other':
    case 'skipTurns':
      return 0;
    default:
      return LEVELS[level].lasting.includes(mission.type) ? reward * 0.5 : 0;
  }
}

/** The best thing the AI can buy in a shop, if any (spec 053, 2.3). */
function purchase(game: Game, state: GameState, shopId: string, level: AiLevel, random: Random): { action: GameAction; name: string; value: number } | null {
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
          value: characterValue(character),
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

/** The chance of the AI in the showdown, its team as side b when it is player 2. */
function showdownChance(game: Game, state: GameState, player: PlayerId, memory: AiMemory, random: Random): number {
  const known = memory.chances.get('showdown');
  if (known !== undefined) {
    return known;
  }
  const sides = showdownSides(state);
  const teams = { a: toFighters(game, state, sides.a), b: toFighters(game, state, sides.b) };
  if (teams.a.length === 0 || teams.b.length === 0) {
    return 0.5;
  }
  const stats = fightStats(teams, DEFAULT_SETTINGS, SIMULATIONS, random);
  const chance = (player === 'p1' ? stats.wins.a : stats.wins.b) / SIMULATIONS;
  memory.chances.set('showdown', chance);
  return chance;
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

  if (rules.usesItems) {
    // Manual powers with an effect the app applies: at once.
    for (const power of me.powers) {
      const { effect } = power.definition;
      const useful = effect.type === 'addCoins' || effect.type === 'extraActions' || effect.type === 'skipOpponentTurn';
      const action: GameAction = { type: 'usePower', player, powerId: power.id };
      if (useful && (power.usesLeft ?? 0) > 0 && allowed(action)) {
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
    const best = purchase(game, state, position, level, random);
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
      const right = random() < rules.quiz;
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

  // Interact with the character where it stands, when it is worth it.
  if (
    actionsLeft > 0 &&
    interactionsLeft > 0 &&
    !isRepeatInteraction(state, position) &&
    !memory.resolved.has(cellKey) &&
    cellValue(game, state, position, level, memory, random) > 0 &&
    allowed({ type: 'interact', nodeId: position })
  ) {
    return { kind: 'interact', nodeId: position, text: `Incontra ${nameAt(game, state, position)}` };
  }

  if (actionsLeft > 0) {
    const move = chooseMove(game, state, level, memory, random);
    if (move) {
      return { kind: 'act', action: { type: 'move', to: move.to }, text: move.text };
    }
  }
  return { kind: 'end', text: 'Finisce il turno' };
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

/** Where the pawn goes next: one step towards the most convenient cell. */
function chooseMove(game: Game, state: GameState, level: AiLevel, memory: AiMemory, random: Random): { to: string; text: string } | null {
  const player = state.currentPlayer;
  const other: PlayerId = player === 'p1' ? 'p2' : 'p1';
  const rules = LEVELS[level];
  const { distance, first } = paths(game, state, player);
  const position = state.players[player].position;
  const otherPosition = state.players[other].position;
  const neighbours = [...first.entries()].filter(([node]) => distance.get(node) === 1).map(([node]) => node);
  const legal = (to: string) => blockReason(game, { type: 'move', to }) === null;

  let avoid: string | null = null;
  const targets: { node: string; value: number; text: string }[] = [];
  if (rules.showdown && state.players[player].team.length > 0) {
    const chance = showdownChance(game, state, player, memory, random);
    if (chance >= 0.6 && chaseWorthIt(state, player, other)) {
      targets.push({ node: otherPosition, value: 4000, text: `Insegue ${state.players[other].name}` });
    } else if (chance <= 0.4) {
      avoid = otherPosition;
    }
  }

  for (const node of game.map.nodes) {
    if (node.id === position || !distance.has(node.id)) {
      continue;
    }
    if (node.type === 'shop') {
      const best = purchase(game, state, node.id, level, random);
      if (best) {
        targets.push({ node: node.id, value: best.value * 0.8, text: 'Va verso il negozio' });
      }
      continue;
    }
    const value = cellValue(game, state, node.id, level, memory, random);
    if (value > 0) {
      targets.push({ node: node.id, value, text: `Va verso ${nameAt(game, state, node.id)}` });
    }
  }
  // The places its accepted missions ask for (spec 053, 2.3).
  for (const active of state.activeMissions ?? []) {
    if (active.player !== player) {
      continue;
    }
    const mission = cellMission(state.cells[active.nodeId]);
    const targetNode =
      mission?.type === 'goTo' && mission.targetId
        ? active.reachedTarget && mission.returnToGiver
          ? active.nodeId
          : Object.entries(state.cells).find(([, cell]) => cell.characterId === mission.targetId)?.[0]
        : undefined;
    if (mission && targetNode && targetNode !== position && distance.has(targetNode)) {
      targets.push({
        node: targetNode,
        value: rewardValue(game, mission, state.cells[active.nodeId]?.characterId),
        text: `Va verso ${nameAt(game, state, targetNode)} per la missione`,
      });
    }
  }

  const steps = neighbours.filter((node) => node !== avoid && legal(node));
  if (steps.length === 0) {
    return null;
  }
  const wander = random() < rules.wander || targets.length === 0;
  if (wander) {
    if (rules.wander === 0 && targets.length === 0) {
      return null;
    }
    const to = steps[Math.floor(random() * steps.length)] as string;
    return { to, text: 'Si sposta' };
  }
  // Facile goes to the nearest useful cell; the others weigh the reward against the distance.
  const score = (target: { node: string; value: number }) =>
    rules.buysBest
      ? target.value / ((distance.get(target.node) ?? 1) + 1)
      : -(distance.get(target.node) ?? Infinity);
  const ordered = [...targets].sort((a, b) => score(b) - score(a));
  for (const target of ordered) {
    const step = first.get(target.node);
    if (step && steps.includes(step)) {
      return { to: step, text: target.text };
    }
  }
  return null;
}

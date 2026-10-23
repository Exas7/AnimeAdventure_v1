import type {
  ActiveMission,
  CellContent,
  ChallengeFormat,
  Character,
  GameState,
  ItemDefinition,
  Mission,
  MissionReward,
  MissionType,
  PlayerId,
  QuizQuestion,
} from './types';
import { PLAYER_IDS } from './types';

// Missions of the character cells (spec 026, D-039, D-040): what they ask,
// what they give, and when a mission in progress is completed.

export const MISSION_TYPES: { type: MissionType; label: string }[] = [
  { type: 'fight', label: 'Combattimento' },
  { type: 'quiz', label: 'Quiz' },
  { type: 'goTo', label: 'Vai da' },
  { type: 'defeat', label: 'Batti' },
  { type: 'bring', label: 'Porta' },
  { type: 'wait', label: 'Attendi' },
  { type: 'skipTurns', label: 'Salta turni' },
  { type: 'other', label: 'Altro' },
  { type: 'escort', label: 'Accompagnami da' },
];

/** Missions that last over turns: accepted in the scene, then followed by the app. */
export const LASTING_MISSIONS: MissionType[] = ['goTo', 'defeat', 'bring', 'wait', 'skipTurns', 'escort'];

/** A fight in this format with the cell's character, won to recruit it. */
export function fightMission(format: ChallengeFormat): Mission {
  return { type: 'fight', format, condition: 'win', reward: { cellCharacter: true } };
}

/**
 * A new mission of a kind, as the cell form starts it: a fight 1v1, a quiz
 * with four empty answers, two turns to wait or one to skip. The reward
 * stays when the host changes kind; a new one recruits the cell's character.
 */
export function defaultMission(
  type: MissionType,
  reward: MissionReward = { cellCharacter: true },
): Mission {
  switch (type) {
    case 'fight':
      return { type, format: '1v1', condition: 'win', reward };
    case 'quiz':
      return { type, quiz: { question: '', answers: ['', '', '', ''], correct: 0 }, reward };
    case 'goTo':
      return { type, returnToGiver: false, reward };
    case 'defeat':
    case 'bring':
    case 'escort':
      return { type, reward };
    case 'wait':
      return { type, turns: 2, reward };
    case 'skipTurns':
      return { type, turns: 1, reward };
    case 'other':
      return { type, text: '', reward };
  }
}

/**
 * The mission of a cell. Content prepared before missions had only a
 * format: it is read as a fight in that format (D-039). No mission and no
 * format: the cell works as before, with lines and "Assegna".
 */
export function cellMission(content: CellContent | undefined): Mission | undefined {
  if (content?.mission) {
    return content.mission;
  }
  return content?.format ? fightMission(content.format) : undefined;
}

/**
 * A quiz whose answers are all the same, as the «Lisa» of Livio (spec 074,
 * 2.4; D-099): a lottery, whose right answer is drawn at every challenge.
 */
export function isLottery(quiz: QuizQuestion | undefined): boolean {
  const first = quiz?.answers[0]?.trim().toLowerCase();
  return (
    quiz !== undefined &&
    quiz.answers.length > 1 &&
    first !== '' &&
    quiz.answers.every((answer) => answer.trim().toLowerCase() === first)
  );
}

/**
 * The right answer of a lottery at a new challenge (spec 074, 2.4): drawn
 * from the state of the game, so that the players cannot foresee it and an
 * undo followed by the same move draws the same one.
 */
export function lotteryDraw(state: GameState, nodeId: string, count: number): number {
  const players = PLAYER_IDS.map((id) => `${state.players[id].coins}:${state.players[id].team.join(',')}`);
  return mixedHash([nodeId, state.turn, state.currentPlayer, ...players].join('|')) % count;
}

/** FNV-1a, with the final mix of MurmurHash3: the low bits change with any input. */
function mixedHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** The cell where a character stands on the board, if any. */
export function nodeOfCharacter(state: GameState, characterId: string): string | undefined {
  return Object.entries(state.cells).find(([, cell]) => cell.characterId === characterId)?.[0];
}

const nameIn = (catalog: Character[]) => (id: string) =>
  catalog.find((character) => character.id === id)?.name ?? id;

/** "Combattimento 2v2", "Quiz", "Missione · Porta Vegeta": the heading of the scene. */
export function missionLabel(mission: Mission, catalog: Character[]): string {
  const name = nameIn(catalog);
  const target = mission.targetId ? name(mission.targetId) : '?';
  const turns = mission.turns ?? 0;
  const turnWord = turns === 1 ? 'turno' : 'turni';
  switch (mission.type) {
    case 'fight': {
      const against = mission.opponents?.length ? ` contro ${listed(mission.opponents.map(name))}` : '';
      const transform = mission.condition === 'transform' ? ' · deve trasformarsi' : '';
      return `Combattimento ${mission.format ?? '1v1'}${against}${transform}`;
    }
    case 'quiz':
      return 'Quiz';
    case 'goTo':
      return `Missione · Vai da ${target}${mission.returnToGiver ? ' e torna' : ''}`;
    case 'defeat':
      return `Missione · Batti ${target}`;
    case 'bring':
      return `Missione · Porta ${target}`;
    case 'escort':
      return `Missione · Accompagnami da ${target}`;
    case 'wait':
      return `Missione · Attendi ${turns} ${turnWord}`;
    case 'skipTurns':
      return `Missione · Salta ${turns} ${turnWord}`;
    case 'other':
      return mission.text?.trim() ? `Missione · ${mission.text.trim()}` : 'Missione';
  }
}

/** "Krilin, Trunks (bambino), 500 monete, Senzu"; empty when the mission gives nothing. */
export function rewardText(
  reward: MissionReward,
  cellCharacterId: string | undefined,
  catalog: Character[],
  items: ItemDefinition[],
): string {
  const name = nameIn(catalog);
  const parts: string[] = [];
  if (reward.cellCharacter && cellCharacterId) {
    parts.push(name(cellCharacterId));
  }
  parts.push(...(reward.characters ?? []).map(name));
  if (reward.coins) {
    parts.push(`${reward.coins} monete`);
  }
  parts.push(
    ...(reward.items ?? []).map((id) => items.find((item) => item.id === id)?.name ?? id),
  );
  return parts.join(', ');
}

/** "Bulma: attendi 3 turni (ne mancano 2)", for the player's panel. */
export function activeMissionText(
  active: ActiveMission,
  state: GameState,
  catalog: Character[],
): string {
  const { giver, task } = activeMissionParts(active, state, catalog);
  return `${giver}: ${task}`;
}

/**
 * Who gave a mission in progress and what it asks, apart: "Bulma" and
 * "attendi 3 turni (ne mancano 2)". The phone shows the name only and the
 * task on a tap (spec 058).
 */
export function activeMissionParts(
  active: ActiveMission,
  state: GameState,
  catalog: Character[],
): { giver: string; task: string } {
  const name = nameIn(catalog);
  const giverId = state.cells[active.nodeId]?.characterId;
  const giver = giverId ? name(giverId) : 'Missione';
  return { giver, task: missionTask(active, state, catalog, giver) };
}

function missionTask(active: ActiveMission, state: GameState, catalog: Character[], giver: string): string {
  const name = nameIn(catalog);
  const mission = cellMission(state.cells[active.nodeId]);
  if (!mission) {
    return 'missione tolta dalla casella';
  }
  const target = mission.targetId ? name(mission.targetId) : '?';
  const turns = mission.turns ?? 0;
  switch (mission.type) {
    case 'goTo':
      if (mission.returnToGiver) {
        return active.reachedTarget
          ? `sei stato da ${target}, ora torna da ${giver}`
          : `vai da ${target}, poi torna`;
      }
      return `vai da ${target}`;
    case 'defeat':
      return `batti ${target}`;
    case 'bring':
      return `porta ${target} in squadra`;
    case 'escort':
      return `viaggia con te fino a ${target}`;
    case 'wait': {
      // Spec 078: the turns are skipped by the app; a mission accepted before plays them (old rule).
      const left =
        active.turnsToSkipLeft ??
        Math.max(0, turns - (state.players[active.player].turnsPlayed - active.turnsPlayedAtStart));
      return `attendi ${turns} ${turns === 1 ? 'turno' : 'turni'} (${leftText(left)})`;
    }
    case 'skipTurns': {
      const left = active.turnsToSkipLeft ?? 0;
      return `salta ${turns} ${turns === 1 ? 'turno' : 'turni'} (${leftText(left)})`;
    }
    case 'fight':
    case 'quiz':
    case 'other':
      return missionLabel(mission, catalog).toLowerCase();
  }
}

/** A player's missions in progress, as the panels show them (spec 026, 2.4). */
export interface PanelMission {
  id: number;
  nodeId: string;
  text: string;
}

export function missionsOf(
  state: GameState,
  playerId: PlayerId,
  catalog: Character[],
): PanelMission[] {
  return (state.activeMissions ?? [])
    .filter((active) => active.player === playerId)
    .map((active) => ({
      id: active.id,
      nodeId: active.nodeId,
      text: activeMissionText(active, state, catalog),
    }));
}

/**
 * The missions in progress whose condition is met now (D-040): the director
 * proposes their reward. Fights, quizzes and "other" missions are judged by
 * the host in the scene, so they never show up here.
 */
export function missionsDone(state: GameState): ActiveMission[] {
  return (state.activeMissions ?? []).filter((active) => isDone(state, active));
}

function isDone(state: GameState, active: ActiveMission): boolean {
  const mission = cellMission(state.cells[active.nodeId]);
  if (!mission) {
    return false;
  }
  const player = state.players[active.player];
  const targetNode = mission.targetId ? nodeOfCharacter(state, mission.targetId) : undefined;
  switch (mission.type) {
    case 'goTo':
      if (mission.returnToGiver) {
        return Boolean(active.reachedTarget) && player.position === active.nodeId;
      }
      return targetNode !== undefined && player.position === targetNode;
    case 'defeat':
      return targetNode !== undefined && state.conquests[targetNode] === active.player;
    case 'bring':
      return mission.targetId !== undefined && player.team.includes(mission.targetId);
    case 'escort':
      return targetNode !== undefined && player.position === targetNode;
    case 'wait':
      return active.turnsToSkipLeft !== undefined
        ? active.turnsToSkipLeft <= 0
        : player.turnsPlayed - active.turnsPlayedAtStart >= (mission.turns ?? 0);
    case 'skipTurns':
      return (active.turnsToSkipLeft ?? 0) <= 0;
    case 'fight':
    case 'quiz':
    case 'other':
      return false;
  }
}

/**
 * The cells of the givers of an «Accompagnami da» in progress (spec 069,
 * 2.5): they travel with the player, so their cell looks empty and nobody
 * meets them there.
 */
export function awayCells(state: GameState): Map<string, PlayerId> {
  return new Map(
    (state.activeMissions ?? [])
      .filter((active) => cellMission(state.cells[active.nodeId])?.type === 'escort')
      .map((active) => [active.nodeId, active.player]),
  );
}

/** Who travels with the player, if anyone: one companion at a time (D-097). */
export function companionOf(state: GameState, playerId: PlayerId): string | undefined {
  const node = [...awayCells(state)].find(([, player]) => player === playerId)?.[0];
  return node ? state.cells[node]?.characterId : undefined;
}

/** A pawn moved: a "vai da … e torna" mission remembers that the target was reached. */
export function notePawnMoved(state: GameState, playerId: PlayerId, nodeId: string): void {
  for (const active of state.activeMissions ?? []) {
    if (active.player !== playerId || active.reachedTarget) {
      continue;
    }
    const mission = cellMission(state.cells[active.nodeId]);
    if (mission?.type === 'goTo' && mission.returnToGiver && mission.targetId) {
      if (nodeOfCharacter(state, mission.targetId) === nodeId) {
        active.reachedTarget = true;
      }
    }
  }
}

/** A turn of the player was skipped: it counts for one "salta turni" mission. */
export function noteTurnSkipped(state: GameState, playerId: PlayerId): void {
  const active = (state.activeMissions ?? []).find(
    (candidate) => candidate.player === playerId && (candidate.turnsToSkipLeft ?? 0) > 0,
  );
  if (active?.turnsToSkipLeft) {
    active.turnsToSkipLeft -= 1;
  }
}

/** Checks the shape of a mission read from a file or from the browser. */
export function looksLikeMission(value: unknown): value is Mission {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const mission = value as Record<string, unknown>;
  const optional = (key: string, check: (field: unknown) => boolean) =>
    mission[key] === undefined || check(mission[key]);
  const text = (field: unknown) => typeof field === 'string';
  const texts = (field: unknown) => Array.isArray(field) && field.every(text);
  const reward = mission.reward as Record<string, unknown> | undefined;
  const quiz = mission.quiz as Record<string, unknown> | undefined;
  return (
    MISSION_TYPES.some((entry) => entry.type === mission.type) &&
    optional('opponents', texts) &&
    optional('format', (field) => field === '1v1' || field === '2v2' || field === '3v3') &&
    optional('condition', (field) => field === 'win' || field === 'transform') &&
    optional('targetId', text) &&
    optional('returnToGiver', (field) => typeof field === 'boolean') &&
    optional('turns', (field) => typeof field === 'number') &&
    optional('text', text) &&
    optional(
      'quiz',
      () =>
        typeof quiz === 'object' &&
        quiz !== null &&
        typeof quiz.question === 'string' &&
        texts(quiz.answers) &&
        typeof quiz.correct === 'number',
    ) &&
    typeof reward === 'object' &&
    reward !== null &&
    (reward.cellCharacter === undefined || typeof reward.cellCharacter === 'boolean') &&
    (reward.characters === undefined || texts(reward.characters)) &&
    (reward.coins === undefined || typeof reward.coins === 'number') &&
    (reward.items === undefined || texts(reward.items))
  );
}

function leftText(left: number): string {
  if (left === 0) {
    return 'fatto';
  }
  return left === 1 ? 'ne manca 1' : `ne mancano ${left}`;
}

/** "A", "A e B", "A, B e C". */
function listed(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

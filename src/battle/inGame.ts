import {
  cellMission,
  personOf,
  personOfId,
  PLAYER_IDS,
  TEAM_SIZE,
  type Character,
  type GameState,
  type Mission,
  type PlayerId,
} from '../engine';
import { tierRank, type Random } from '../episode/fill';
import { transformationsOf, type FightRecord } from './fight';

// The simulated fight inside the game (spec 037, 2.4-2.5, D-058): who is
// proposed on the field, which forms a transformation may not take, and what
// the fight proposes to the host, who always has the last click.

export interface Sides {
  /** The player of the mission, or player 1 in the showdown. */
  a: string[];
  /** The opponents of the mission, or player 2 in the showdown. */
  b: string[];
}

/**
 * A fight mission: the player's first characters, as many as the format asks
 * (1v1 without a format), against the mission's opponents or the cell's
 * character. The host can change both before the fight.
 */
export function missionSides(state: GameState, nodeId: string, player: PlayerId): Sides {
  const content = state.cells[nodeId];
  const mission = cellMission(content);
  const size = formatSize(mission);
  const opponents = mission?.opponents?.length
    ? mission.opponents
    : content?.characterId
      ? [content.characterId]
      : [];
  return { a: state.players[player].team.slice(0, size), b: opponents.slice(0, TEAM_SIZE) };
}

/** How many fight on each side: 2 in a 2v2; 1 without a format. */
function formatSize(mission: Mission | undefined): number {
  return Number(mission?.format?.charAt(0) ?? '1');
}

/**
 * What "Simula" proposes for a fight mission (spec 048, D-075): the sides of
 * the mission and, when the opponents are fewer than the format asks, the
 * partners that are missing. The host can still change both sides.
 */
export function proposedMissionSides(
  state: GameState,
  nodeId: string,
  player: PlayerId,
  catalog: readonly Character[],
  random: Random = Math.random,
): Sides {
  const sides = missionSides(state, nodeId, player);
  const missing = formatSize(cellMission(state.cells[nodeId])) - sides.b.length;
  if (missing <= 0) {
    return sides;
  }
  return { ...sides, b: [...sides.b, ...partnersFor(state, catalog, sides.b, missing, random)] };
}

/**
 * Partners for the opponents (spec 048, 2.2): the same saga and side
 * (villain or not) as the first opponent, then the same side, then anyone;
 * in each group the closest tier, ties at random. Never a character without
 * a tier, another form of a person already on that side, or a person of the
 * players' teams. Characters on the board may join: opponents are no place
 * (D-066).
 */
export function partnersFor(
  state: GameState,
  catalog: readonly Character[],
  opponents: readonly string[],
  missing: number,
  random: Random = Math.random,
): string[] {
  const first = catalog.find((character) => character.id === opponents[0]);
  if (!first) {
    return [];
  }
  const firstRank = tierRank(first.tier) ?? 0;
  const villain = (character: Character) => character.villain === true;
  const teams = new Set(
    PLAYER_IDS.flatMap((id) => state.players[id].team.map((member) => personOfId(catalog, member))),
  );
  const onSide = new Set(opponents.map((id) => personOfId(catalog, id)));
  const groups: ((character: Character) => boolean)[] = [
    (character) => character.saga === first.saga && villain(character) === villain(first),
    (character) => villain(character) === villain(first),
    () => true,
  ];
  const partners: string[] = [];
  for (let count = 0; count < missing; count += 1) {
    const free = catalog.filter(
      (character) =>
        tierRank(character.tier) !== null && !onSide.has(personOf(character)) && !teams.has(personOf(character)),
    );
    const group = groups.map((inGroup) => free.filter(inGroup)).find((candidates) => candidates.length > 0);
    if (!group) {
      break;
    }
    const distance = (character: Character) => Math.abs((tierRank(character.tier) ?? 0) - firstRank);
    const best = Math.min(...group.map(distance));
    const closest = group.filter((character) => distance(character) === best);
    const partner = closest[Math.floor(random() * closest.length)] ?? (closest[0] as Character);
    partners.push(partner.id);
    onSide.add(personOf(partner));
  }
  return partners;
}

/** The showdown: the first five of each team, in team order. */
export function showdownSides(state: GameState): Sides {
  return { a: state.players.p1.team.slice(0, TEAM_SIZE), b: state.players.p2.team.slice(0, TEAM_SIZE) };
}

/**
 * Every character somewhere in the game: in a team, in a cell (shopkeepers
 * too) or for sale. A transformation never takes one of these forms, so a
 * person stays in one place (D-064).
 */
export function charactersInGame(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const player of PLAYER_IDS) {
    for (const id of state.players[player].team) {
      ids.add(id);
    }
  }
  for (const content of Object.values(state.cells)) {
    if (content.characterId) {
      ids.add(content.characterId);
    }
    for (const id of content.forSale ?? []) {
      ids.add(id);
    }
  }
  return ids;
}

export type MissionOutcome = 'won' | 'lost' | 'transformed';

/**
 * The outcome proposed for a fight mission. For "costringimi a trasformarmi"
 * it is enough that an opponent transformed, even if the player lost.
 */
export function proposedOutcome(record: FightRecord, mission: Mission | undefined): MissionOutcome {
  if (mission?.condition === 'transform') {
    const transformed = record.steps.some(({ event }) => event.type === 'transform' && event.side === 'b');
    return transformed ? 'transformed' : 'lost';
  }
  return record.winner === 'a' ? 'won' : 'lost';
}

/**
 * The changes of "Aggiorna la squadra": the player's characters that ended
 * the fight in another form. Opponents always go back as they were (D-060).
 */
export function teamChanges(record: FightRecord, team: readonly string[]): { from: string; to: string }[] {
  return transformationsOf(record, 'a')
    .filter(({ from }) => team.includes(from.id))
    .map(({ from, to }) => ({ from: from.id, to: to.id }));
}

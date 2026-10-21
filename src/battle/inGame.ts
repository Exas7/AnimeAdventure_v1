import { cellMission, PLAYER_IDS, TEAM_SIZE, type GameState, type Mission, type PlayerId } from '../engine';
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
  const size = Number(mission?.format?.charAt(0) ?? '1');
  const opponents = mission?.opponents?.length
    ? mission.opponents
    : content?.characterId
      ? [content.characterId]
      : [];
  return { a: state.players[player].team.slice(0, size), b: opponents.slice(0, TEAM_SIZE) };
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

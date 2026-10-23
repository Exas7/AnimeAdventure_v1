import { EngineError } from './errors';
import { findCharacter, personOf, personOfId } from './lookup';
import { notify, type ActionOutput } from './output';
import { replaceInTeam } from './team';
import { PLAYER_IDS, type Character, type GameContext, type GameState, type PlayerId } from './types';

// Fusions (spec 068): two characters of one team who fuse in the story become
// one, stronger. The codes are those of the included list.

interface FusionPair {
  /** The forms of each of the two: base, and SSJ (SSJ2 and SSJ3 count as SSJ). */
  first: { base: string[]; ssj: string[] };
  second: { base: string[]; ssj: string[] };
  /** What they may become: in base form, and when both are SSJ. */
  base: string[];
  ssj: string[];
}

export const FUSION_PAIRS: FusionPair[] = [
  // Goku and Vegeta at the end of Dragon Ball. There is no base Gogeta in BT3:
  // in base form only Vegetto. Majin Vegeta counts as an SSJ Vegeta.
  {
    first: { base: ['son-goku-fine'], ssj: ['son-goku-fine-ssj', 'son-goku-fine-ssj2', 'son-goku-fine-ssj3'] },
    second: { base: ['vegeta-seconda-forma'], ssj: ['vegeta-seconda-forma-ssj', 'vegeta-seconda-forma-ssj2', 'majin-vegeta'] },
    base: ['vegetto'],
    ssj: ['super-vegetto', 'super-gogeta'],
  },
  {
    first: { base: [], ssj: ['son-goku-ssj4'] },
    second: { base: [], ssj: ['vegeta-ssj4'] },
    base: [],
    ssj: ['gogeta-ssj4'],
  },
  {
    first: { base: ['son-goten'], ssj: ['son-goten-ssj'] },
    second: { base: ['trunks-bambino'], ssj: ['trunks-bambino-ssj'] },
    base: ['gotenks'],
    ssj: ['gotenks-ssj'],
  },
];

export interface FusionOption {
  /** The two of the team who fuse, in team order. */
  members: [string, string];
  /** The character they become. */
  resultId: string;
}

/**
 * The fusions a player may do now (spec 068, 2.1 and 2.3): a pair in the
 * team, SSJ when both are, never a fusion whose person is already in a team.
 */
export function fusionOptions(state: GameState, catalog: readonly Character[], playerId: PlayerId): FusionOption[] {
  const team = state.players[playerId].team;
  const taken = new Set(
    PLAYER_IDS.flatMap((id) => state.players[id].team.map((member) => personOfId(catalog, member))),
  );
  const options: FusionOption[] = [];
  for (const pair of FUSION_PAIRS) {
    const first = team.find((id) => pair.first.base.includes(id) || pair.first.ssj.includes(id));
    const second = team.find((id) => pair.second.base.includes(id) || pair.second.ssj.includes(id));
    if (!first || !second) {
      continue;
    }
    const members: [string, string] = team.indexOf(first) < team.indexOf(second) ? [first, second] : [second, first];
    const ssj = pair.first.ssj.includes(first) && pair.second.ssj.includes(second);
    for (const resultId of ssj ? pair.ssj : pair.base) {
      const result = catalog.find((character) => character.id === resultId);
      if (result && !taken.has(personOf(result))) {
        options.push({ members, resultId });
      }
    }
  }
  return options;
}

/** "Son Goku (fine) e Vegeta (seconda forma)": who fuse, in words. */
export function fusionPairText(option: FusionOption, catalog: readonly Character[]): string {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  return `${name(option.members[0])} e ${name(option.members[1])}`;
}

/** A cell turned off by a fusion (spec 068, 2.3): nobody may meet it any more. */
export function isOffCell(state: GameState, nodeId: string): boolean {
  return (state.offCells ?? []).includes(nodeId);
}

/**
 * The two leave the team and the fusion takes the place of the first; the
 * starter follows it. The fusion's person, on the board, turns its cell off
 * for both players; in a shop, leaves the sale (spec 068, 2.2 and 2.3).
 */
export function fuse(
  state: GameState,
  context: GameContext,
  playerId: PlayerId,
  members: readonly [string, string],
  resultId: string,
  out: ActionOutput,
): void {
  const player = state.players[playerId];
  const result = findCharacter(context.catalog, resultId);
  if (members[0] === members[1] || !members.every((id) => player.team.includes(id))) {
    throw new EngineError(`The fusion needs two characters of the team of ${player.name}`);
  }
  // The fusion takes the place of whichever of the two comes first in the team.
  const [first, second] =
    player.team.indexOf(members[0]) < player.team.indexOf(members[1]) ? members : [members[1], members[0]];
  replaceInTeam(state, playerId, first, result.id);
  player.team.splice(player.team.indexOf(second), 1);
  if (player.starterId === second) {
    player.starterId = result.id;
  }

  const person = personOf(result);
  const samePerson = (id: string | undefined) => id !== undefined && personOfId(context.catalog, id) === person;
  for (const [nodeId, cell] of Object.entries(state.cells)) {
    if (samePerson(cell.characterId) && state.conquests[nodeId] === undefined && !isOffCell(state, nodeId)) {
      state.offCells = [...(state.offCells ?? []), nodeId];
    }
    if (cell.forSale?.some(samePerson)) {
      state.cells[nodeId] = { ...cell, forSale: cell.forSale.filter((id) => !samePerson(id)) };
    }
  }
  const names = members.map((id) => findCharacter(context.catalog, id).name);
  notify(state, out, `${player.name}: ${names[0]} e ${names[1]} si fondono in ${result.name}`, { inLog: false });
}

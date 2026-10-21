import { EngineError } from './errors';
import { findCharacter } from './lookup';
import { warn, type ActionOutput } from './output';
import { PLAYER_IDS, TEAM_SIZE, type GameContext, type GameState, type PlayerId } from './types';

/**
 * Adds a character to a team; beyond TEAM_SIZE it joins as an extra, with a
 * warning. Purchases pass `warnIfFull: false`: for them the full team is a
 * turn rule, already warned by rules.ts (D-015).
 */
export function addToTeam(
  state: GameState,
  context: GameContext,
  playerId: PlayerId,
  characterId: string,
  out: ActionOutput,
  { warnIfFull = true }: { warnIfFull?: boolean } = {},
): void {
  const character = findCharacter(context.catalog, characterId);
  const player = state.players[playerId];
  if (warnIfFull && player.team.length >= TEAM_SIZE) {
    warn(out, 'teamFull', `La squadra di ${player.name} è completa`);
  }
  player.team.push(character.id);
}

/**
 * A character the player receives (spec 020, "Assegna"; spec 026, rewards):
 * not added twice to the same team, with a warning when the other team has
 * it too. Past limits only warn (D-008).
 */
export function joinTeam(
  state: GameState,
  context: GameContext,
  playerId: PlayerId,
  characterId: string,
  out: ActionOutput,
): void {
  const character = findCharacter(context.catalog, characterId);
  const player = state.players[playerId];
  const holder = PLAYER_IDS.find((id) => state.players[id].team.includes(characterId));
  if (holder === playerId) {
    warn(out, 'characterInTeam', `${character.name} è già nella squadra di ${player.name}`);
    return;
  }
  if (holder !== undefined) {
    warn(
      out,
      'characterInTeam',
      `${character.name} è anche nella squadra di ${state.players[holder].name}`,
    );
  }
  addToTeam(state, context, playerId, characterId, out);
}

/**
 * "Aggiorna la squadra" (spec 037, 2.4, D-060): each new form takes the place
 * of the old one in the team, and the starter follows it. A form already in
 * a team only warns (D-008).
 */
export function transformInTeam(
  state: GameState,
  context: GameContext,
  playerId: PlayerId,
  changes: readonly { from: string; to: string }[],
  out: ActionOutput,
): void {
  for (const { from, to } of changes) {
    const character = findCharacter(context.catalog, to);
    const holder = PLAYER_IDS.find((id) => state.players[id].team.includes(to));
    if (holder !== undefined) {
      warn(
        out,
        'characterInTeam',
        `${character.name} è già nella squadra di ${state.players[holder].name}`,
      );
    }
    replaceInTeam(state, playerId, from, character.id);
  }
}

/** The new form takes the place of the old one in the team, and the starter follows it (D-060). */
export function replaceInTeam(state: GameState, playerId: PlayerId, from: string, to: string): void {
  const player = state.players[playerId];
  const index = player.team.indexOf(from);
  if (index === -1) {
    throw new EngineError(`Character "${from}" is not in the team of ${player.name}`);
  }
  player.team[index] = to;
  if (player.starterId === from) {
    player.starterId = to;
  }
}

export function removeFromTeam(
  state: GameState,
  playerId: PlayerId,
  characterId: string,
  out: ActionOutput,
): void {
  const player = state.players[playerId];
  const index = player.team.indexOf(characterId);
  if (index === -1) {
    throw new EngineError(`Character "${characterId}" is not in the team of ${player.name}`);
  }
  if (characterId === player.starterId) {
    warn(out, 'starterRemoved', 'Lo starter resta sempre in squadra');
  }
  player.team.splice(index, 1);
}

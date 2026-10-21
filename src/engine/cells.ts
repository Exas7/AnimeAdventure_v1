import { cellNumber } from './cellNumber';
import { cleanLines } from './lines';
import { cellLabel, deepCopy, findCharacter, personOfId, validateCellContent } from './lookup';
import { warn, type ActionOutput } from './output';
import { PLAYER_IDS, type CellContent, type GameContext, type GameState } from './types';

/**
 * Replaces the content of a cell (D-016). A character that is already in
 * another cell or for sale in a shop is placed anyway, with a warning
 * (spec 002: every character appears once per game; D-008).
 */
export function setCellContent(
  state: GameState,
  context: GameContext,
  nodeId: string,
  content: CellContent,
  out: ActionOutput,
): void {
  validateCellContent(context.map, context.catalog, nodeId, content);
  const previous = state.cells[nodeId] ?? {};

  const newcomers = [
    ...(content.characterId !== undefined && content.characterId !== previous.characterId
      ? [content.characterId]
      : []),
    ...(content.forSale ?? []).filter((id) => !(previous.forSale ?? []).includes(id)),
  ];
  for (const characterId of newcomers) {
    warnIfElsewhere(state, context, characterId, out, nodeId);
  }

  const cleaned = cleanContent(content);
  if (Object.keys(cleaned).length === 0) {
    delete state.cells[nodeId];
  } else {
    state.cells[nodeId] = cleaned;
  }
}

/**
 * A warning when the character, or another form of its person, is already
 * in a cell, for sale or in a team (spec 039, D-064): it is placed anyway
 * (D-008).
 */
export function warnIfElsewhere(
  state: GameState,
  context: GameContext,
  characterId: string,
  out: ActionOutput,
  exceptNodeId?: string,
): void {
  const found = placedElsewhere(state, context, characterId, exceptNodeId);
  if (!found) {
    return;
  }
  const name = findCharacter(context.catalog, characterId).name;
  warn(
    out,
    'characterAlreadyPlaced',
    found.id === characterId
      ? `${name} è già ${found.where}`
      : `${name}: c'è già ${findCharacter(context.catalog, found.id).name} ${found.where}`,
  );
}

/** Where else the character or a form of its person is, as a phrase for the warning; null if nowhere. */
function placedElsewhere(
  state: GameState,
  context: GameContext,
  characterId: string,
  exceptNodeId: string | undefined,
): { id: string; where: string } | null {
  const person = personOfId(context.catalog, characterId);
  return placedWhere(
    state,
    context,
    (id) => id === characterId || personOfId(context.catalog, id) === person,
    exceptNodeId,
  );
}

/**
 * The first cell, shop or team holding a character that matches, with where
 * it is as a phrase for a warning ("sulla casella #12"); null if none.
 */
export function placedWhere(
  state: GameState,
  context: GameContext,
  same: (characterId: string) => boolean,
  exceptNodeId?: string,
): { id: string; where: string } | null {
  for (const [nodeId, content] of Object.entries(state.cells)) {
    if (nodeId === exceptNodeId) {
      continue;
    }
    // A conquered cell keeps its character's code, but the character is no longer
    // there: in a team, or gone.
    const conquered = state.conquests[nodeId] !== undefined;
    if (!conquered && content.characterId !== undefined && same(content.characterId)) {
      return { id: content.characterId, where: `sulla casella ${cellNumber(nodeId)}` };
    }
    const sold = content.forSale?.find(same);
    if (sold !== undefined) {
      return { id: sold, where: `in vendita nel ${cellLabel(state, context.map, context.catalog, nodeId)}` };
    }
  }
  for (const player of PLAYER_IDS) {
    const member = state.players[player].team.find(same);
    if (member !== undefined) {
      return { id: member, where: `nella squadra di ${state.players[player].name}` };
    }
  }
  return null;
}

/** Drops empty fields, so an empty cell has no content at all. */
function cleanContent(content: CellContent): CellContent {
  const cleaned: CellContent = {};
  if (content.characterId) {
    cleaned.characterId = content.characterId;
  }
  const lines = cleanLines(content.lines);
  if (lines.length > 0) {
    cleaned.lines = lines;
  }
  if (content.mission) {
    cleaned.mission = deepCopy(content.mission);
  }
  if (content.format) {
    cleaned.format = content.format;
  }
  if (content.forSale) {
    cleaned.forSale = [...content.forSale];
  }
  return cleaned;
}

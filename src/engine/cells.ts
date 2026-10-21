import { cellNumber } from './cellNumber';
import { cleanLines } from './lines';
import { cellLabel, deepCopy, findCharacter, validateCellContent } from './lookup';
import { warn, type ActionOutput } from './output';
import type { CellContent, GameContext, GameState } from './types';

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
    const where = placedElsewhere(state, context, characterId, nodeId);
    if (where) {
      const name = findCharacter(context.catalog, characterId).name;
      warn(out, 'characterAlreadyPlaced', `${name} è già ${where}`);
    }
  }

  const cleaned = cleanContent(content);
  if (Object.keys(cleaned).length === 0) {
    delete state.cells[nodeId];
  } else {
    state.cells[nodeId] = cleaned;
  }
}

/** Where else the character is, as a phrase for the warning; null if nowhere. */
function placedElsewhere(
  state: GameState,
  context: GameContext,
  characterId: string,
  exceptNodeId: string,
): string | null {
  for (const [nodeId, content] of Object.entries(state.cells)) {
    if (nodeId === exceptNodeId) {
      continue;
    }
    if (content.characterId === characterId) {
      return `sulla casella ${cellNumber(nodeId)}`;
    }
    if (content.forSale?.includes(characterId)) {
      return `in vendita nel ${cellLabel(state, context.map, context.catalog, nodeId)}`;
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

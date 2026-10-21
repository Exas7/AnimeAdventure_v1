import type { CellContent, GameMap, NodeType } from '../engine';
import type { Content } from './fill';

export interface DroppedContent {
  nodeId: string;
  /** 'deleted': the cell is gone; 'type': its new type cannot keep it. */
  reason: 'deleted' | 'type';
  lost: CellContent;
}

const HOLDS_CHARACTER: NodeType[] = ['character', 'shop'];

/**
 * Content of an episode after a change to its map (spec 015, D-025): a
 * deleted cell loses all its content; a cell whose new type cannot hold a
 * character loses it (D-023), a cell that is no longer a Character cell
 * loses its mission and lines (spec 034, 2.5: they belonged to that
 * character), and a cell that is no longer a shop loses what it sold.
 * Cells whose type did not change keep everything, so data saved before
 * D-023 stays as it was.
 */
export function contentAfterMapChange(
  before: GameMap,
  after: GameMap,
  content: Content,
): { content: Content; dropped: DroppedContent[] } {
  const oldTypes = new Map(before.nodes.map((node) => [node.id, node.type]));
  const newTypes = new Map(after.nodes.map((node) => [node.id, node.type]));
  const result: Content = { ...content };
  const dropped: DroppedContent[] = [];

  for (const [nodeId, cell] of Object.entries(content)) {
    const newType = newTypes.get(nodeId);
    if (newType === undefined) {
      delete result[nodeId];
      dropped.push({ nodeId, reason: 'deleted', lost: cell });
      continue;
    }
    if (newType === oldTypes.get(nodeId)) {
      continue;
    }
    const kept: CellContent = { ...cell };
    const lost: CellContent = {};
    if (kept.characterId !== undefined && !HOLDS_CHARACTER.includes(newType)) {
      lost.characterId = kept.characterId;
      delete kept.characterId;
    }
    if (oldTypes.get(nodeId) === 'character') {
      for (const key of ['mission', 'lines', 'format'] as const) {
        if (kept[key] !== undefined) {
          Object.assign(lost, { [key]: kept[key] });
          delete kept[key];
        }
      }
    }
    if (kept.forSale !== undefined && newType !== 'shop') {
      lost.forSale = kept.forSale;
      delete kept.forSale;
    }
    if (Object.keys(lost).length === 0) {
      continue;
    }
    dropped.push({ nodeId, reason: 'type', lost });
    if (Object.keys(kept).length > 0) {
      result[nodeId] = kept;
    } else {
      delete result[nodeId];
    }
  }
  return { content: result, dropped };
}

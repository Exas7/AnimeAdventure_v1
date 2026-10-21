import { cellNumber, type CellContent, type Character, type GameMap } from '../engine';
import { canBeDrawn, tierRank, type Content } from './fill';
import { charactersInContent } from './stepRandomize';

export interface Replacement {
  starterName: string;
  /** Name of the character that took the starter's place, or null if none was left. */
  replacementName: string | null;
  /** Where: a cell or a shop, by node id. */
  nodeId: string;
  /** For sale in a shop. */
  inShop: boolean;
  /** The starter kept this shop (spec 022, 2.4). */
  asKeeper?: true;
}

export interface PreparedContent {
  content: Content;
  /** Characters of the episode that are not in the current catalog (removed). */
  missing: string[];
  replacements: Replacement[];
}

/**
 * Content of an episode ready for a new game (spec 007, 2.7): characters
 * missing from the catalog are removed; the chosen starters leave the map.
 * Their substitutes follow the rules of "Randomizza" (spec 022, 2.4; D-034):
 * in a cell, an unused recruitable character from C- up, never a
 * shopkeeper, of the nearest tier; for sale, the same with a price; as a
 * shopkeeper (in `shopIds`), another free shopkeeper. Never one that a
 * mission names as opponent, target or reward (spec 034, 2.5).
 */
export function prepareEpisodeContent(
  content: Content,
  catalog: Character[],
  starterIds: string[],
  shopIds: ReadonlySet<string> = new Set(),
): PreparedContent {
  const known = new Map(catalog.map((character) => [character.id, character]));
  const missing = new Set<string>();
  const result: Content = {};

  for (const [nodeId, cell] of Object.entries(content)) {
    const next: CellContent = { ...cell };
    if (next.characterId !== undefined && !known.has(next.characterId)) {
      missing.add(next.characterId);
      delete next.characterId;
    }
    if (next.forSale) {
      next.forSale = next.forSale.filter((id) => {
        if (!known.has(id)) {
          missing.add(id);
          return false;
        }
        return true;
      });
    }
    result[nodeId] = next;
  }

  const used = charactersInContent(result);
  starterIds.forEach((id) => used.add(id));
  const replacements: Replacement[] = [];

  const fits = (character: Character, place: 'cell' | 'sale' | 'keeper') =>
    !used.has(character.id) &&
    (place === 'keeper'
      ? character.shopkeeper === true
      : canBeDrawn(character) && (place === 'cell' || character.price !== undefined));

  const replacementFor = (
    starter: Character,
    place: 'cell' | 'sale' | 'keeper',
  ): Character | undefined => {
    const target = tierRank(starter.tier);
    const candidates = catalog.filter((character) => fits(character, place));
    const distance = (character: Character) => {
      const rank = tierRank(character.tier);
      return target === null || rank === null ? 99 : Math.abs(rank - target);
    };
    return [...candidates].sort((a, b) => distance(a) - distance(b))[0];
  };

  for (const starterId of starterIds) {
    const starter = known.get(starterId);
    if (!starter) {
      continue;
    }
    for (const [nodeId, cell] of Object.entries(result)) {
      if (cell.characterId === starterId) {
        const asKeeper = shopIds.has(nodeId);
        const substitute = replacementFor(starter, asKeeper ? 'keeper' : 'cell');
        if (substitute) {
          used.add(substitute.id);
          cell.characterId = substitute.id;
        } else {
          delete cell.characterId;
        }
        replacements.push({
          starterName: starter.name,
          replacementName: substitute?.name ?? null,
          nodeId,
          inShop: false,
          ...(asKeeper ? { asKeeper: true as const } : {}),
        });
      }
      if (cell.forSale?.includes(starterId)) {
        const substitute = replacementFor(starter, 'sale');
        if (substitute) {
          used.add(substitute.id);
        }
        cell.forSale = cell.forSale.flatMap((id) =>
          id !== starterId ? [id] : substitute ? [substitute.id] : [],
        );
        replacements.push({
          starterName: starter.name,
          replacementName: substitute?.name ?? null,
          nodeId,
          inShop: true,
        });
      }
    }
  }

  return { content: result, missing: [...missing], replacements };
}

/** Lines for the director about what changed when the episode started (spec 007, 2.7). */
export function preparationReport(prepared: PreparedContent): string[] {
  const lines: string[] = [];
  if (prepared.missing.length > 0) {
    lines.push(
      `Non sono nel catalogo attuale e i loro posti partono vuoti: ${prepared.missing.join(', ')}.`,
    );
  }
  for (const replacement of prepared.replacements) {
    const number = cellNumber(replacement.nodeId);
    const where = replacement.asKeeper
      ? `dal negozio ${number}, dove faceva il negoziante`
      : replacement.inShop
        ? `dal negozio ${number}`
        : `dalla casella ${number}`;
    lines.push(
      replacement.replacementName
        ? `Starter ${replacement.starterName} tolto ${where}: al suo posto ${replacement.replacementName}.`
        : `Starter ${replacement.starterName} tolto ${where}: nessun sostituto disponibile, il posto resta vuoto.`,
    );
  }
  return lines;
}

/**
 * The map a game starts with: character cells left without a character do
 * not exist in a game, they become passage cells (D-023).
 */
export function withoutEmptyCharacterCells(map: GameMap, content: Content): GameMap {
  if (!map.nodes.some((node) => node.type === 'character' && !content[node.id]?.characterId)) {
    return map;
  }
  return {
    ...map,
    nodes: map.nodes.map((node) =>
      node.type === 'character' && !content[node.id]?.characterId ? { ...node, type: 'empty' } : node,
    ),
  };
}

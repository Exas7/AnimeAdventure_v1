import { cellNumber } from './cellNumber';
import { EngineError } from './errors';
import type {
  CellContent,
  Character,
  GameMap,
  GameState,
  ItemDefinition,
  MapEdge,
  MapNode,
  PlayerId,
  PlayerState,
  PowerState,
} from './types';

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

export function findNode(map: GameMap, nodeId: string): MapNode {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new EngineError(`Unknown node "${nodeId}"`);
  }
  return node;
}

export function findEdge(map: GameMap, edgeId: string): MapEdge {
  const edge = map.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new EngineError(`Unknown edge "${edgeId}"`);
  }
  return edge;
}

export function findCharacter(catalog: Character[], characterId: string): Character {
  const character = catalog.find((candidate) => candidate.id === characterId);
  if (!character) {
    throw new EngineError(`Unknown character "${characterId}"`);
  }
  return character;
}

export function findPower(player: PlayerState, powerId: string): PowerState {
  const power = player.powers.find((candidate) => candidate.id === powerId);
  if (!power) {
    throw new EngineError(`Unknown power "${powerId}" for ${player.name}`);
  }
  return power;
}

export function findItem(items: ItemDefinition[], itemId: string): ItemDefinition {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new EngineError(`Unknown item "${itemId}"`);
  }
  return item;
}

/** Name used in messages: the character in the cell, the shop, or the cell number (spec 023). */
export function cellLabel(state: GameState, map: GameMap, catalog: Character[], nodeId: string): string {
  const node = findNode(map, nodeId);
  const characterId = state.cells[node.id]?.characterId;
  const character = catalog.find((candidate) => candidate.id === characterId);
  if (node.type === 'shop') {
    return character ? `negozio di ${character.name}` : `negozio ${cellNumber(node.id)}`;
  }
  return character ? character.name : `casella ${cellNumber(node.id)}`;
}

/** Throws if a cell content refers to an unknown cell or character, or sells outside a shop. */
export function validateCellContent(
  map: GameMap,
  catalog: Character[],
  nodeId: string,
  content: CellContent,
): void {
  const node = findNode(map, nodeId);
  if (content.characterId !== undefined) {
    findCharacter(catalog, content.characterId);
  }
  if (content.forSale !== undefined && node.type !== 'shop') {
    throw new EngineError(`Cell "${nodeId}" is not a shop and cannot sell characters`);
  }
  for (const characterId of content.forSale ?? []) {
    findCharacter(catalog, characterId);
  }
  const mission = content.mission;
  if (mission) {
    for (const characterId of [
      ...(mission.opponents ?? []),
      ...(mission.targetId !== undefined ? [mission.targetId] : []),
      ...(mission.reward.characters ?? []),
    ]) {
      findCharacter(catalog, characterId);
    }
  }
}

/** Deep copy of plain JSON data, such as a game state or a map. */
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The person of a character (D-064): the "persona" column, or the character alone. */
export function personOf(character: Character): string {
  return character.person?.trim() || `#${character.id}`;
}

/** The person of a character of the list by its code; a code not in the list is a person alone. */
export function personOfId(catalog: readonly Character[], characterId: string): string {
  const character = catalog.find((entry) => entry.id === characterId);
  return character ? personOf(character) : `#${characterId}`;
}

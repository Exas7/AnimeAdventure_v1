import { cellMission, cellNumber, personOf, type Character, type GameMap } from '../engine';
import type { Content } from './fill';

export interface EpisodeIssue {
  kind: 'duplicate' | 'unknown' | 'samePerson' | 'targetMissing' | 'bringMissing' | 'rewardOnBoard';
  message: string;
}

/**
 * The pairs of the chains behind grey roads (spec 027, 2.4): the one who
 * opens the road and the one in the dead end behind it. They may be one
 * person (D-066).
 */
function chainPairs(map: GameMap, content: Content): Set<string> {
  const pairs = new Set<string>();
  for (const edge of map.edges) {
    const key = edge.unlockNodeId;
    const behind = key === edge.from ? edge.to : key === edge.to ? edge.from : undefined;
    const opener = key ? content[key]?.characterId : undefined;
    const last = behind ? content[behind]?.characterId : undefined;
    if (edge.locked && opener && last) {
      pairs.add([opener, last].sort().join('|'));
    }
  }
  return pairs;
}

/**
 * Guides for the episode (spec 007, 2.6), never blocking (D-008): characters
 * used more than once, and characters missing from the current catalog.
 */
export function checkEpisode(content: Content, catalog: Character[], map?: GameMap): EpisodeIssue[] {
  const names = new Map(catalog.map((character) => [character.id, character.name]));
  const uses = new Map<string, number>();
  const count = (id: string) => uses.set(id, (uses.get(id) ?? 0) + 1);
  for (const cell of Object.values(content)) {
    if (cell.characterId) {
      count(cell.characterId);
    }
    for (const id of cell.forSale ?? []) {
      count(id);
    }
  }

  const issues: EpisodeIssue[] = [];
  const duplicates = [...uses].filter(([, times]) => times > 1);
  if (duplicates.length > 0) {
    const list = duplicates.map(([id, times]) => `${names.get(id) ?? id} (${times} volte)`);
    issues.push({ kind: 'duplicate', message: `Usati più di una volta: ${list.join(', ')}.` });
  }
  // One person in one place (spec 039): two forms in cells, shops or rewards, chains excepted (D-066).
  const promised = Object.values(content).flatMap((cell) => cell.mission?.reward.characters ?? []);
  const byPerson = new Map<string, Set<string>>();
  for (const id of [...uses.keys(), ...promised]) {
    const character = catalog.find((entry) => entry.id === id);
    if (character) {
      const person = personOf(character);
      byPerson.set(person, (byPerson.get(person) ?? new Set()).add(id));
    }
  }
  const pairs = map ? chainPairs(map, content) : new Set<string>();
  const shared = [...byPerson.values()]
    .map((ids) => [...ids])
    .filter((ids) => ids.length > 1 && !(ids.length === 2 && pairs.has([...ids].sort().join('|'))));
  if (shared.length > 0) {
    const list = shared.map((ids) => ids.map((id) => names.get(id) ?? id).join(', '));
    issues.push({ kind: 'samePerson', message: `Stessa persona in più posti: ${list.join('; ')}.` });
  }
  const unknown = [...uses.keys()].filter((id) => !names.has(id));
  if (unknown.length > 0) {
    issues.push({
      kind: 'unknown',
      message: `Non sono nel catalogo attuale: ${unknown.join(', ')}. In partita quei posti restano vuoti.`,
    });
  }
  return issues;
}

/**
 * Guides on the missions (spec 026, 2.2), never blocking: "Vai da" and
 * "Batti" towards a character who is not on the board; "Porta" a character
 * who is neither on the board nor for sale; a reward who is on the board too.
 */
export function checkMissions(content: Content, catalog: Character[]): EpisodeIssue[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const onBoard = new Set(
    Object.values(content).flatMap((cell) => (cell.characterId ? [cell.characterId] : [])),
  );
  const forSale = new Set(Object.values(content).flatMap((cell) => cell.forSale ?? []));
  const missing: string[] = [];
  const cannotBring: string[] = [];
  const doubled: string[] = [];
  for (const [nodeId, cell] of Object.entries(content)) {
    const mission = cellMission(cell);
    if (!mission) {
      continue;
    }
    const giver = `${cell.characterId ? name(cell.characterId) : 'Casella'} (${cellNumber(nodeId)})`;
    const target = mission.targetId;
    if ((mission.type === 'goTo' || mission.type === 'defeat') && target && !onBoard.has(target)) {
      missing.push(`${giver} → ${name(target)}`);
    }
    if (mission.type === 'bring' && target && !onBoard.has(target) && !forSale.has(target)) {
      cannotBring.push(`${giver} → ${name(target)}`);
    }
    for (const id of mission.reward.characters ?? []) {
      if (onBoard.has(id) || forSale.has(id)) {
        doubled.push(`${giver} → ${name(id)}`);
      }
    }
  }

  const issues: EpisodeIssue[] = [];
  if (missing.length > 0) {
    issues.push({
      kind: 'targetMissing',
      message: `Missioni con l'obiettivo fuori dal tabellone: ${missing.join(', ')}.`,
    });
  }
  if (cannotBring.length > 0) {
    issues.push({
      kind: 'bringMissing',
      message: `Da portare, ma né sul tabellone né in un negozio: ${cannotBring.join(', ')}.`,
    });
  }
  if (doubled.length > 0) {
    issues.push({
      kind: 'rewardOnBoard',
      message: `Premi che stanno anche sul tabellone o in vendita: ${doubled.join(', ')}.`,
    });
  }
  return issues;
}

/** Character cells without a character: in a game they become passage cells (D-023). */
export function emptyCharacterCells(map: GameMap, content: Content): string[] {
  return map.nodes
    .filter((node) => node.type === 'character' && !content[node.id]?.characterId)
    .map((node) => node.id);
}

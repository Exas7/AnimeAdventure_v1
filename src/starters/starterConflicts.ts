import { cellNumber, PLAYER_IDS, type CellContent, type Character, type GameMap } from '../engine';
import type { StarterProposals } from './proposals';

/**
 * Guides of "Nuova partita" (spec 034, 2.5): a proposed starter that the
 * episode already uses, on the map, for sale, or inside a mission. They
 * never block: the host decides what to change.
 */
export function starterConflicts(
  proposals: StarterProposals,
  content: Record<string, CellContent>,
  map: GameMap,
  catalog: Character[],
): string[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const shops = new Set(map.nodes.filter((node) => node.type === 'shop').map((node) => node.id));
  const proposed = [
    ...new Set(
      PLAYER_IDS.flatMap((player) =>
        proposals[player].flatMap((proposal) => (proposal.characterId ? [proposal.characterId] : [])),
      ),
    ),
  ];
  const lines: string[] = [];
  for (const id of proposed) {
    for (const [nodeId, cell] of Object.entries(content)) {
      const number = cellNumber(nodeId);
      if (cell.characterId === id) {
        lines.push(
          shops.has(nodeId)
            ? `${name(id)} fa il negoziante nel negozio ${number}: se viene scelto, lì ne arriva un altro.`
            : `${name(id)} è nella casella ${number}: se viene scelto, lì ne arriva un altro.`,
        );
      }
      if (cell.forSale?.includes(id)) {
        lines.push(`${name(id)} è in vendita nel negozio ${number}: se viene scelto, al suo posto ne arriva un altro.`);
      }
      const mission = cell.mission;
      if (!mission) {
        continue;
      }
      const whose = cell.characterId
        ? `di ${name(cell.characterId)} (casella ${number})`
        : `della casella ${number}`;
      if (mission.targetId === id) {
        lines.push(`${name(id)} è l'obiettivo della missione ${whose}: se viene scelto, la missione va cambiata.`);
      }
      if (mission.reward.characters?.includes(id)) {
        lines.push(`${name(id)} è il premio della missione ${whose}: se viene scelto, la missione va cambiata.`);
      }
      if (mission.opponents?.includes(id)) {
        lines.push(`${name(id)} è tra gli avversari della missione ${whose}.`);
      }
    }
  }
  return lines;
}

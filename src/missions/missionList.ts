import {
  cellMission,
  cellNumber,
  missionLabel,
  rewardText,
  type CellContent,
  type Character,
  type GameMap,
  type GameState,
  type ItemDefinition,
  type MissionType,
  type PlayerId,
  type QuizQuestion,
} from '../engine';

// All the missions of an episode or of a game in one list (spec 029): no
// need to open the cells one by one.

/** Where a mission stands in a game. */
export type MissionStatus =
  | { kind: 'free' }
  | { kind: 'active'; players: PlayerId[] }
  | { kind: 'done'; player: PlayerId };

export interface MissionRow {
  nodeId: string;
  /** "#12". */
  cell: string;
  character: string;
  /** The kind of mission; 'none' for a character without one ("Assegna" as before). */
  kind: MissionType | 'none';
  /** As in the scene: "Combattimento 2v2", "Missione · Batti Hildegarn"; "—" without a mission. */
  mission: string;
  /** "Tapion, 500 monete"; "—" when it gives nothing. */
  reward: string;
  lines: string[];
  quiz?: QuizQuestion;
  /** Only in a game. */
  status?: MissionStatus;
}

/**
 * One row for every cell with a character that is not a shop, in cell
 * order. With the game state, each row also says where the mission stands.
 */
export function missionRows(
  map: GameMap,
  content: Record<string, CellContent>,
  catalog: Character[],
  items: ItemDefinition[],
  state?: GameState,
): MissionRow[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  return map.nodes
    .filter((node) => node.type !== 'shop' && content[node.id]?.characterId)
    .sort((a, b) => cellOrder(a.id) - cellOrder(b.id) || a.id.localeCompare(b.id))
    .map((node): MissionRow => {
      const cell = content[node.id] ?? {};
      const mission = cellMission(cell);
      const reward = mission ? rewardText(mission.reward, cell.characterId, catalog, items) : '';
      return {
        nodeId: node.id,
        cell: cellNumber(node.id),
        character: name(cell.characterId ?? ''),
        kind: mission?.type ?? 'none',
        mission: mission ? missionLabel(mission, catalog) : '—',
        reward: reward || '—',
        lines: cell.lines ?? [],
        ...(mission?.type === 'quiz' && mission.quiz ? { quiz: mission.quiz } : {}),
        ...(state ? { status: statusOf(state, node.id) } : {}),
      };
    });
}

function statusOf(state: GameState, nodeId: string): MissionStatus {
  const conqueror = state.conquests[nodeId];
  if (conqueror) {
    return { kind: 'done', player: conqueror };
  }
  const players = [
    ...new Set(
      (state.activeMissions ?? [])
        .filter((active) => active.nodeId === nodeId)
        .map((active) => active.player),
    ),
  ];
  return players.length > 0 ? { kind: 'active', players } : { kind: 'free' };
}

/** The number in a cell code: "n12" comes after "n9"; codes without one go last. */
function cellOrder(nodeId: string): number {
  const match = /(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export type MissionFilter = 'all' | MissionType | 'none' | MissionStatus['kind'];

export const KIND_FILTERS: { filter: MissionFilter; label: string }[] = [
  { filter: 'all', label: 'Tutte' },
  { filter: 'fight', label: 'Combattimenti' },
  { filter: 'quiz', label: 'Quiz' },
  { filter: 'goTo', label: 'Vai da' },
  { filter: 'defeat', label: 'Batti' },
  { filter: 'bring', label: 'Porta' },
  { filter: 'wait', label: 'Attendi' },
  { filter: 'skipTurns', label: 'Salta turni' },
  { filter: 'comeBack', label: 'Ripassa' },
  { filter: 'other', label: 'Altro' },
  { filter: 'none', label: 'Senza missione' },
];

export const STATUS_FILTERS: { filter: MissionFilter; label: string }[] = [
  { filter: 'free', label: 'Libere' },
  { filter: 'active', label: 'In corso' },
  { filter: 'done', label: 'Completate' },
];

export function matchesFilter(row: MissionRow, filter: MissionFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'free' || filter === 'active' || filter === 'done') {
    return row.status?.kind === filter;
  }
  return row.kind === filter;
}

export function countFor(rows: MissionRow[], filter: MissionFilter): number {
  return rows.filter((row) => matchesFilter(row, filter)).length;
}

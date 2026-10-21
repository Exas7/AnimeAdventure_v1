import { isEpisodeData, upgradeEpisodeTexts, type Episode } from '../episode/episodeFile';
import { withStore } from './database';

// The library of prepared episodes in the browser (D-019).

export interface EpisodeSummary {
  id: string;
  name: string;
  mapName: string;
  updatedAt: number;
  /** Cells with a character in them. */
  filledCells: number;
}

interface EpisodeEntry {
  id: string;
  episode: Episode;
  updatedAt: number;
}

export function newEpisodeId(): string {
  return crypto.randomUUID();
}

/** Saved episodes, most recently changed first. Unreadable entries are skipped. */
export async function listEpisodes(): Promise<EpisodeSummary[]> {
  const values = await withStore<unknown[]>('episodes', 'readonly', (store) => store.getAll());
  return values
    .filter(isEntry)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((entry) => ({
      id: entry.id,
      name: entry.episode.name,
      mapName: entry.episode.map.name,
      updatedAt: entry.updatedAt,
      filledCells: Object.values(entry.episode.content).filter((cell) => cell.characterId).length,
    }));
}

export async function loadEpisode(id: string): Promise<Episode | null> {
  const value = await withStore<unknown>('episodes', 'readonly', (store) => store.get(id));
  return isEntry(value) ? value.episode : null;
}

export async function saveEpisode(id: string, episode: Episode): Promise<void> {
  const entry: EpisodeEntry = { id, episode, updatedAt: Date.now() };
  await withStore('episodes', 'readwrite', (store) => store.put(entry, id));
}

export async function deleteEpisode(id: string): Promise<void> {
  await withStore('episodes', 'readwrite', (store) => store.delete(id));
}

function isEntry(value: unknown): value is EpisodeEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<EpisodeEntry>;
  // Episodes saved before D-031 have balloon and task: they are read as lines.
  upgradeEpisodeTexts(entry.episode);
  return (
    typeof entry.id === 'string' &&
    typeof entry.updatedAt === 'number' &&
    isEpisodeData(entry.episode)
  );
}

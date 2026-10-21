import {
  looksLikeMission,
  upgradeCellTexts,
  type CellContent,
  type Character,
  type GameMap,
} from '../engine';
import { looksLikeSpecialKeeper } from '../catalog/specialKeepers';
import { isMapData } from '../editor/mapFile';
import { looksLikeProposals, type StarterProposals } from '../starters/proposals';

/** A prepared episode (D-019): a copy of the map plus the content of its cells. */
export interface Episode {
  name: string;
  map: GameMap;
  content: Record<string, CellContent>;
  /**
   * Copies of the special shopkeepers its shops use (D-035), so the episode
   * works on another computer too. Missing in episodes saved before.
   */
  keepers?: Character[];
  /**
   * The three starters proposed to each player, with copies of their powers
   * (spec 025, D-038). Missing in episodes saved before, or when none is set.
   */
  starters?: StarterProposals;
}

/** Internal code: stays 'arkanite-…' after the rename, or old files would not open (D-020). */
const EPISODE_FORMAT = 'arkanite-episode';

/**
 * Increase when the episode file changes, and teach `upgradeEpisodeTexts`
 * how to bring older files up to date.
 * 1: first format. 2: balloon and task become lines (D-031). 3: copies of
 * the special shopkeepers (D-035); older files simply have none. 4: the
 * proposed starters (D-038); older files simply have none. 5: missions in
 * the cells (D-039); older cells keep their format, read as a fight.
 */
export const EPISODE_FORMAT_VERSION = 5;

/** An episode file that cannot be loaded. The message is meant for the host. */
export class EpisodeFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EpisodeFileError';
  }
}

export function serializeEpisode(episode: Episode): string {
  return JSON.stringify({ format: EPISODE_FORMAT, version: EPISODE_FORMAT_VERSION, episode });
}

export function parseEpisode(text: string): Episode {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new EpisodeFileError('Il file è danneggiato: il contenuto non è leggibile.', {
      cause: error,
    });
  }
  if (!isRecord(data) || data.format !== EPISODE_FORMAT) {
    throw new EpisodeFileError('Il file non è una puntata.');
  }
  if (
    typeof data.version !== 'number' ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    data.version > EPISODE_FORMAT_VERSION
  ) {
    throw new EpisodeFileError(
      `La puntata usa la versione ${String(data.version)} del formato, ` +
        `ma questa app sa leggere solo fino alla versione ${EPISODE_FORMAT_VERSION}.`,
    );
  }
  if (data.version < 2) {
    upgradeEpisodeTexts(data.episode);
  }
  if (!isEpisodeData(data.episode)) {
    throw new EpisodeFileError('Il file è danneggiato: mancano parti della puntata.');
  }
  return data.episode;
}

/**
 * Brings an episode prepared before D-031 up to date: in every cell, balloon
 * and task become lines. Works on raw data and changes it in place; an
 * episode that already has lines stays as it is.
 */
export function upgradeEpisodeTexts(episode: unknown): void {
  if (isRecord(episode) && isRecord(episode.content)) {
    Object.values(episode.content).forEach(upgradeCellTexts);
  }
}

/** Checks the shape of an episode, e.g. one read back from the browser's library. */
export function isEpisodeData(value: unknown): value is Episode {
  if (!isRecord(value) || typeof value.name !== 'string' || !isMapData(value.map)) {
    return false;
  }
  const nodeIds = new Set(value.map.nodes.map((node) => node.id));
  const { content, keepers, starters } = value;
  return (
    isRecord(content) &&
    Object.entries(content).every(([nodeId, cell]) => nodeIds.has(nodeId) && isCellContent(cell)) &&
    (keepers === undefined || (Array.isArray(keepers) && keepers.every(looksLikeSpecialKeeper))) &&
    (starters === undefined || looksLikeProposals(starters))
  );
}

function isCellContent(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const optionalText = (key: string) => value[key] === undefined || typeof value[key] === 'string';
  const optionalTextList = (key: string) =>
    value[key] === undefined ||
    (Array.isArray(value[key]) && value[key].every((text) => typeof text === 'string'));
  return (
    ['characterId', 'format'].every(optionalText) &&
    ['lines', 'forSale'].every(optionalTextList) &&
    (value.mission === undefined || looksLikeMission(value.mission))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { parseGame, serializeGame, type Game, type GameMap } from '../engine';
import { serializeMap } from '../editor/mapFile';
import { serializeEpisode, type Episode } from '../episode/episodeFile';

/** Downloads the game as a .json file (spec 001, section 8). */
export function downloadGame(game: Game): void {
  downloadText(serializeGame(game), saveFileName(new Date()));
}

/** Downloads a map as a .json file, background included (D-018). */
export function downloadMap(map: GameMap): void {
  downloadText(serializeMap(map), mapFileName(map.name));
}

/** Downloads a prepared episode as a .json file: map copy and content (D-019). */
export function downloadEpisode(episode: Episode): void {
  downloadText(serializeEpisode(episode), `puntata-${slugOf(episode.name)}.json`);
}

/** Downloads a CSV for Excel: the catalog of missions or the quiz questions (D-041). */
export function downloadCsv(text: string, fileName: string): void {
  downloadText(text, fileName, 'text/csv;charset=utf-8');
}

/** Reads a saved game. Throws SaveFileError with a clear message if the file is not valid. */
export async function readGameFile(file: File): Promise<Game> {
  return parseGame(await file.text());
}

export function saveFileName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `partita-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

export function mapFileName(name: string): string {
  return `mappa-${slugOf(name)}.json`;
}

function slugOf(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'senza-nome';
}

function downloadText(text: string, fileName: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser time to start the download before releasing the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

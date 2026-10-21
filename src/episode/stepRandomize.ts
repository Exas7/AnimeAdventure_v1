import type { Character, GameMap } from '../engine';
import { proposedCharacters, type StarterProposals } from '../starters/proposals';
import { randomStarters, type RandomStarters } from '../starters/randomStarters';
import type { ReadyPower } from '../starters/readyPowers';
import { randomize, shuffle, usedCharacters, type Content, type Random, type RandomizeResult } from './fill';
import {
  randomizeWithMissions,
  type MissionRandomizeResult,
  type MissionSources,
  type RandomExtra,
} from './missionFill';
import type { TextLibrary } from './textLibrary';

// "Randomizza" one step at a time, or all at once (spec 030): the steps of
// "＋ Nuova puntata" and "Randomizza tutto" in "Nuova partita".

/** Characters for sale in each shop, unless the host says otherwise (spec 028). */
export const DEFAULT_PER_SHOP = 3;

/** What every draw needs: the libraries, and the source of random numbers. */
export interface RandomSources {
  catalog: Character[];
  specialKeepers: Character[];
  powers: ReadyPower[];
  texts: TextLibrary;
  missions: MissionSources;
  perShop: number;
  random: Random;
}

/** What the draw could not fill (spec 033, 2.3). */
export interface Shortages {
  cellsLeftEmpty: number;
  forSaleLeftEmpty: number;
  keepersKept: number;
}

export interface StepResult {
  content: Content;
  /** What the draw did, one line each, for the summary under the button. */
  summary: string[];
  shortages: Shortages;
}

export interface CellsStepResult extends StepResult {
  extras: RandomExtra[];
}

function shortagesOf(result: RandomizeResult): Shortages {
  return {
    cellsLeftEmpty: result.cellsLeftEmpty,
    forSaleLeftEmpty: result.forSaleLeftEmpty,
    keepersKept: result.keepersKept,
  };
}

/**
 * Everyone the episode already uses: in a cell, in a shop, for sale, and in
 * a mission as opponent, target or prize. Random starters avoid them (D-044).
 */
export function charactersInContent(content: Content): Set<string> {
  const used = usedCharacters(content);
  for (const cell of Object.values(content)) {
    const mission = cell.mission;
    for (const id of [
      ...(mission?.opponents ?? []),
      ...(mission?.targetId ? [mission.targetId] : []),
      ...(mission?.reward.characters ?? []),
    ]) {
      used.add(id);
    }
  }
  return used;
}

/** "Pianeta Nameck · 2" when "Pianeta Nameck · 1" exists: the first free number. */
export function nextEpisodeName(mapName: string, existing: string[]): string {
  const taken = new Set(existing.map((name) => name.trim()));
  let number = 1;
  while (taken.has(`${mapName} · ${number}`)) {
    number++;
  }
  return `${mapName} · ${number}`;
}

/**
 * Step "Mappa e nome": a map at random among those with at least one
 * Character cell; a map without (such as "Mappa di prova") would give an
 * empty episode. Null when no map has one.
 */
export async function pickPlayableMap<T extends { id: string }>(
  options: readonly T[],
  load: (id: string) => Promise<GameMap | null>,
  random: Random,
): Promise<{ option: T; map: GameMap } | null> {
  for (const option of shuffle([...options], random)) {
    const map = await load(option.id);
    if (map?.nodes.some((node) => node.type === 'character')) {
      return { option, map };
    }
  }
  return null;
}

/** Step "Starter": never someone already on the map (D-044). */
export function randomizeStartersStep(content: Content | null, sources: RandomSources): RandomStarters {
  return randomStarters(sources.catalog, sources.powers, charactersInContent(content ?? {}), sources.random);
}

/** Step "Negozi": only the shops; the character cells stay as they are. */
export function randomizeShopsStep(
  map: GameMap,
  content: Content,
  starters: StarterProposals,
  sources: RandomSources,
): StepResult {
  const shops = map.nodes.filter((node) => node.type === 'shop').map((node) => node.id);
  const result = randomize(
    map,
    content,
    sources.catalog,
    sources.specialKeepers,
    sources.texts,
    shops,
    sources.perShop,
    sources.random,
    proposedCharacters(starters),
  );
  return { content: result.content, summary: shopLines(result), shortages: shortagesOf(result) };
}

/**
 * Step "Personaggi e missioni": the character cells; the shops filled at the
 * step before stay, the empty ones are filled too (as before spec 030).
 */
export function randomizeCellsStep(
  map: GameMap,
  content: Content,
  starters: StarterProposals,
  sources: RandomSources,
): CellsStepResult {
  const targets = map.nodes
    .filter((node) => node.type === 'character' || (node.type === 'shop' && !content[node.id]?.characterId))
    .map((node) => node.id);
  const result = randomizeWithMissions(
    map,
    content,
    sources.catalog,
    sources.specialKeepers,
    sources.texts,
    targets,
    sources.perShop,
    sources.random,
    sources.missions,
    // The proposed starters never go on the map (D-044).
    proposedCharacters(starters),
  );
  return {
    content: result.content,
    summary: cellLines(result),
    shortages: shortagesOf(result),
    extras: result.extras,
  };
}

export interface RandomEpisode {
  starters: StarterProposals;
  content: Content;
  /** What each step did, for the summaries under the buttons: starters, shops, cells. */
  starterNotes: string[];
  shopSummary: string[];
  cellSummary: string[];
  /** For the tendine of "Randomizza tutto" (spec 033, 2.3): both steps together. */
  extras: RandomExtra[];
  shortages: Shortages;
}

/** "Puntata casuale" and "Randomizza tutto": starters, shops, cells, in this order. */
export function randomEpisode(map: GameMap, sources: RandomSources): RandomEpisode {
  const starters = randomizeStartersStep(null, sources);
  const shops = randomizeShopsStep(map, {}, starters.proposals, sources);
  const cells = randomizeCellsStep(map, shops.content, starters.proposals, sources);
  return {
    starters: starters.proposals,
    content: cells.content,
    starterNotes: starters.notes,
    shopSummary: shops.summary,
    cellSummary: cells.summary,
    extras: cells.extras,
    shortages: {
      cellsLeftEmpty: cells.shortages.cellsLeftEmpty,
      forSaleLeftEmpty: shops.shortages.forSaleLeftEmpty + cells.shortages.forSaleLeftEmpty,
      keepersKept: shops.shortages.keepersKept + cells.shortages.keepersKept,
    },
  };
}

export interface ShopRow {
  nodeId: string;
  keeper: string;
  forSale: string[];
}

/** The shops after "Randomizza i negozi": who keeps each one and what it sells. */
export function shopRows(map: GameMap, content: Content, catalog: Character[]): ShopRow[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  return map.nodes
    .filter((node) => node.type === 'shop')
    .map((node) => {
      const cell = content[node.id];
      return {
        nodeId: node.id,
        keeper: cell?.characterId ? name(cell.characterId) : '—',
        forSale: (cell?.forSale ?? []).map(name),
      };
    });
}

function shopLines(result: RandomizeResult): string[] {
  return [
    `${result.shops} negozi, ${result.forSaleFilled} personaggi in vendita` +
      `${result.forSaleLeftEmpty > 0 ? `, ne mancano ${result.forSaleLeftEmpty}` : ''}.`,
    ...(result.keepersKept > 0
      ? [`${result.keepersKept} negozi tengono il negoziante di prima: non ce n'erano altri liberi.`]
      : []),
  ];
}

function cellLines(result: MissionRandomizeResult): string[] {
  return [
    `${result.cellsFilled} Caselle personaggio riempite` +
      `${result.cellsLeftEmpty > 0 ? `, ${result.cellsLeftEmpty} rimaste vuote (mancano personaggi adatti)` : ''}.`,
    `${result.missions} missioni dal catalogo, ${result.storyCharacters} personaggi della storia.`,
    ...(result.shops > 0 ? shopLines(result) : []),
    ...result.notes,
  ];
}

import { cellNumber, type Character, type GameMap, type ItemDefinition } from '../engine';
import { missionRows, type MissionRow } from '../missions/missionList';
import type { Content } from './fill';
import type { RandomExtra } from './missionFill';
import { shopRows, type RandomEpisode, type ShopRow, type Shortages } from './stepRandomize';

// What "Randomizza tutto" shows in "Nuova partita" (spec 033, 2.3): three
// tendine in place of the summary lines.

export interface ExtraGroup {
  title: string;
  lines: string[];
}

export const NO_EXTRAS = 'Nessuna: solo personaggi da reclutare.';

const EXTRA_TITLES: Record<RandomExtra['kind'], string> = {
  story: 'Danno solo una missione, non si reclutano',
  placed: 'Messi sulla mappa per la missione di un altro',
  chain: 'Catene sui percorsi bloccati',
};

/** "Sfide extra": story characters, characters placed for a mission, chains; empty groups left out. */
export function extraGroups(extras: RandomExtra[], catalog: Character[]): ExtraGroup[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const line = (extra: RandomExtra): string => {
    switch (extra.kind) {
      case 'story':
        return `${name(extra.characterId)}, casella ${cellNumber(extra.cellId)}`;
      case 'placed':
        return `${name(extra.characterId)}, casella ${cellNumber(extra.cellId)}: per la missione di ${name(extra.forId)}`;
      case 'chain':
        return (
          `${name(extra.giverId)} nella casella ${cellNumber(extra.cellId)} apre il percorso; ` +
          `dietro, nella ${cellNumber(extra.behindCellId)}, ${name(extra.behindId)}`
        );
    }
  };
  return (Object.keys(EXTRA_TITLES) as RandomExtra['kind'][])
    .map((kind) => ({
      title: EXTRA_TITLES[kind],
      lines: extras.filter((extra) => extra.kind === kind).map(line),
    }))
    .filter((group) => group.lines.length > 0);
}

/** Said above the missions table when some Character cells stayed empty. */
export function cellShortage(cellsLeftEmpty: number): string | null {
  if (cellsLeftEmpty === 0) {
    return null;
  }
  return cellsLeftEmpty === 1
    ? '1 Casella personaggio rimasta vuota: mancano personaggi adatti.'
    : `${cellsLeftEmpty} Caselle personaggio rimaste vuote: mancano personaggi adatti.`;
}

/** Said inside "Negozi" when something could not be filled. */
export function shopShortages(shortages: Shortages): string[] {
  const { forSaleLeftEmpty: missing, keepersKept: kept } = shortages;
  return [
    ...(missing > 0
      ? [
          `${missing === 1 ? 'Manca 1 personaggio' : `Mancano ${missing} personaggi`} da vendere: ` +
            'non ce ne sono abbastanza con prezzo e non usati.',
        ]
      : []),
    ...(kept > 0
      ? [
          `${kept === 1 ? '1 negozio tiene' : `${kept} negozi tengono`} il negoziante di prima: ` +
            "non ce n'erano altri liberi.",
        ]
      : []),
  ];
}

export interface RandomReport {
  missions: MissionRow[];
  cellShortage: string | null;
  shops: ShopRow[];
  shopShortages: string[];
  extras: ExtraGroup[];
  /** Rare warnings about the starters, shown only when there are some. */
  starterNotes: string[];
}

/** Everything the three tendine show, from the episode just drawn. */
export function randomReport(
  map: GameMap,
  content: Content,
  catalog: Character[],
  items: ItemDefinition[],
  episode: Pick<RandomEpisode, 'extras' | 'shortages' | 'starterNotes'>,
): RandomReport {
  return {
    missions: missionRows(map, content, catalog, items),
    cellShortage: cellShortage(episode.shortages.cellsLeftEmpty),
    shops: shopRows(map, content, catalog),
    shopShortages: shopShortages(episode.shortages),
    extras: extraGroups(episode.extras, catalog),
    starterNotes: episode.starterNotes,
  };
}

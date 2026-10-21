import type { CatalogSummary } from '../catalog/importCatalog';

export type StartMenuId =
  | 'resume'
  | 'newGame'
  | 'episodes'
  | 'maps'
  | 'loadFile'
  | 'importCatalog';

/** One button of the start page menu, with the hint shown on hover (spec 024). */
export interface StartMenuItem {
  id: StartMenuId;
  label: string;
  hint: string;
  primary: boolean;
}

const ITEMS: Omit<StartMenuItem, 'primary'>[] = [
  {
    id: 'resume',
    label: 'Riprendi la partita',
    hint: "Torna alla partita salvata in automatico, dal punto in cui l'hai lasciata.",
  },
  {
    id: 'newGame',
    label: 'Nuova partita',
    hint: 'Scegli mappa o puntata, giocatori e starter, e comincia una partita nuova.',
  },
  {
    id: 'episodes',
    label: 'Puntate',
    hint: 'Prepara le puntate: personaggi nelle caselle, negozi e starter proposti. Qui ci sono anche i negozianti speciali e i poteri.',
  },
  {
    id: 'maps',
    label: 'Editor delle mappe',
    hint: 'Disegna le mappe: sfondo, caselle e percorsi.',
  },
  {
    id: 'loadFile',
    label: 'Carica partita da file',
    hint: 'Riapre una partita esportata su file (.json), anche da un altro PC.',
  },
  {
    id: 'importCatalog',
    label: 'Importa lista personaggi',
    hint: 'Carica la lista dei personaggi da un file CSV (da Excel: Salva con nome → CSV UTF-8). Vale per le partite nuove.',
  },
];

/**
 * The start page menu, top to bottom. "Riprendi la partita" only with a saved
 * game, and then it is the main button; otherwise "Nuova partita" is.
 */
export function startMenu(hasSavedGame: boolean): StartMenuItem[] {
  const main: StartMenuId = hasSavedGame ? 'resume' : 'newGame';
  return ITEMS.filter((item) => hasSavedGame || item.id !== 'resume').map((item) => ({
    ...item,
    primary: item.id === main,
  }));
}

/** The one line under the menu about the imported character list. */
export function catalogStatus(summary: CatalogSummary | null): string {
  if (!summary) {
    return 'Nessuna lista importata: importala per iniziare una partita.';
  }
  return `Lista dei personaggi: ${summary.count} personaggi, ${summary.possibleStarters} possibili starter, ${summary.priced} con prezzo, ${summary.shopkeepers} negozianti, ${summary.withoutTier} senza tier (non arruolabili).`;
}

/** Problems listed after an import; the others are counted. */
const MAX_SHEET_PROBLEMS = 8;

/**
 * The notice after importing a list with wrong fight sheet values (spec 037,
 * 2.2): they count as empty and the list is imported all the same. Empty
 * when there is nothing to say.
 */
export function sheetProblemsNotice(problems: string[]): string[] {
  if (problems.length === 0) {
    return [];
  }
  const shown = problems.slice(0, MAX_SHEET_PROBLEMS);
  const more = problems.length - shown.length;
  return [
    `Lista importata. ${problems.length === 1 ? 'Un valore delle schede di combattimento non va' : `${problems.length} valori delle schede di combattimento non vanno`}: ${problems.length === 1 ? 'vale come vuoto' : 'valgono come vuoti'}.`,
    ...shown,
    ...(more > 0 ? [`E altri ${more}.`] : []),
  ];
}

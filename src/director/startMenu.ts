import type { CatalogSummary } from '../catalog/importCatalog';

export type StartMenuId =
  | 'resume'
  | 'newGame'
  | 'episodes'
  | 'maps'
  | 'loadFile'
  | 'themes';

/**
 * One button of the start page menu, with the hint shown on hover (spec 024)
 * and its dragon ball: the number of stars, or null for the dragon radar of
 * «Riprendi la partita» (spec 050, 2.4).
 */
export interface StartMenuItem {
  id: StartMenuId;
  label: string;
  hint: string;
  primary: boolean;
  stars: number | null;
}

const ITEMS: Omit<StartMenuItem, 'primary'>[] = [
  {
    id: 'resume',
    label: 'Riprendi la partita',
    hint: "Torna alla partita salvata in automatico, dal punto in cui l'hai lasciata.",
    stars: null,
  },
  {
    id: 'newGame',
    label: 'Nuova partita',
    hint: 'Scegli mappa o puntata, giocatori e starter, e comincia una partita nuova.',
    stars: 1,
  },
  {
    id: 'episodes',
    label: 'Puntate',
    hint: 'Prepara le puntate: personaggi nelle caselle, negozi e starter proposti. Qui ci sono anche i negozianti speciali e i poteri.',
    stars: 2,
  },
  {
    id: 'maps',
    label: 'Editor delle mappe',
    hint: 'Disegna le mappe: sfondo, caselle e percorsi.',
    stars: 3,
  },
  {
    id: 'loadFile',
    label: 'Carica partita da file',
    hint: 'Riapre una partita esportata su file (.json), anche da un altro PC.',
    stars: 4,
  },
  {
    id: 'themes',
    label: 'Temi',
    hint: "Scegli i colori dell'app tra cinque temi di Dragon Ball. Cornice e simbolo si cambiano da Impostazioni avanzate.",
    stars: 5,
  },
];

/**
 * The start page menu, top to bottom. "Riprendi la partita" only with a saved
 * game, and then it is the main button; otherwise "Nuova partita" is. The
 * others always carry the balls from one to five stars (spec 050, 2.4).
 */
export function startMenu(hasSavedGame: boolean): StartMenuItem[] {
  const main: StartMenuId = hasSavedGame ? 'resume' : 'newGame';
  return ITEMS.filter((item) => hasSavedGame || item.id !== 'resume').map((item) => ({
    ...item,
    primary: item.id === main,
  }));
}

/**
 * Where the character list is imported, for the messages that send there
 * (spec 042, 2.3): the button is in the advanced settings (D-068).
 */
export const WHERE_TO_IMPORT_CATALOG =
  'dal menu iniziale, in «Impostazioni avanzate» → «Importa lista personaggi»';

export const NO_CATALOG = 'Nessuna lista: importala per iniziare una partita.';

/** The numbers of the character list in use, one per line (spec 042, 2.2). */
export function catalogFigures(summary: CatalogSummary): string[] {
  return [
    counted(summary.count, 'personaggio', 'personaggi'),
    counted(summary.possibleStarters, 'possibile starter', 'possibili starter'),
    `${summary.priced} con prezzo`,
    counted(summary.shopkeepers, 'negoziante', 'negozianti'),
    `${summary.withoutTier} senza tier (non arruolabili)`,
  ];
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Problems listed after an import; the others are counted. */
const MAX_SHEET_PROBLEMS = 8;

/**
 * The notice after a list is imported: how many characters (spec 042, 2.2),
 * or the wrong fight sheet values when there are some (spec 037, 2.2).
 */
export function catalogImportedNotice(summary: CatalogSummary, sheetProblems: string[]): string[] {
  if (sheetProblems.length > 0) {
    return sheetProblemsNotice(sheetProblems);
  }
  return [`Lista importata: ${counted(summary.count, 'personaggio', 'personaggi')}.`];
}

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

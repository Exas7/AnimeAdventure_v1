import type { Character, FightMove, FightSheet } from '../engine';
import { parseCsv } from './csv';

export interface CatalogSummary {
  count: number;
  possibleStarters: number;
  priced: number;
  shopkeepers: number;
  /** Not recruitable (D-034): a forgotten tier shows up here. */
  withoutTier: number;
}

export type CatalogImport =
  | {
      ok: true;
      catalog: Character[];
      summary: CatalogSummary;
      /** Wrong values of the fight sheets (spec 037, 2.2): they count as empty and do not stop the import. */
      sheetProblems: string[];
    }
  | { ok: false; errors: string[] };

type Column =
  | 'name'
  | 'possibleStarter'
  | 'shopkeeper'
  | 'villain'
  | 'person'
  | 'price'
  | 'tier'
  | 'saga'
  | 'race'
  | 'info'
  | 'image'
  | 'bars'
  | 'power'
  | 'speed'
  | 'giant'
  | 'move1'
  | 'move2'
  | 'finale'
  | 'transformsInto'
  | 'transformHeal';

/**
 * Header names of the optional columns (spec 005, 2.1), already normalized.
 * The name is always the first column, whatever its title (spec 010, 2.4).
 */
const COLUMNS: Record<string, Exclude<Column, 'name'>> = {
  'possibile starter': 'possibleStarter',
  negoziante: 'shopkeeper',
  cattivo: 'villain',
  persona: 'person',
  prezzo: 'price',
  tier: 'tier',
  saga: 'saga',
  razza: 'race',
  info: 'info',
  immagine: 'image',
  // The fight simulator's sheet (spec 037, 2.2).
  barre: 'bars',
  potenza: 'power',
  velocita: 'speed',
  gigante: 'giant',
  'mossa 1': 'move1',
  'mossa 2': 'move2',
  'mossa finale': 'finale',
  'si trasforma in': 'transformsInto',
  'cura trasformandosi': 'transformHeal',
};

const YES = new Set(['si', 'x', 'yes', 'true', '1']);

/**
 * Turns a CSV into a catalog: the first row holds the titles, the first
 * column the names (spec 010). Nothing is imported if anything is wrong:
 * the errors say what and where (spec 005).
 */
export function importCatalog(text: string): CatalogImport {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header || rows.every((row) => isBlank(row))) {
    return { ok: false, errors: ['Il file è vuoto.'] };
  }

  const columns: (Column | undefined)[] = header.map((title, index) =>
    index === 0 ? 'name' : COLUMNS[normalize(title)],
  );

  const errors: string[] = [];
  const catalog: Character[] = [];
  const sheetProblems: string[] = [];
  // "si trasforma in" names a character of the list: read once all rows are in.
  const transforms: { character: Character; target: string }[] = [];
  rows.slice(1).forEach((row, index) => {
    if (isBlank(row)) {
      return;
    }
    const rowNumber = index + 2; // the header is row 1
    const value = (column: Column) => {
      const at = columns.indexOf(column);
      return at === -1 ? '' : (row[at] ?? '').trim();
    };

    const name = value('name');
    if (!name) {
      errors.push(`Riga ${rowNumber}: manca il nome.`);
      return;
    }
    const price = parsePrice(value('price'));
    if (price === 'invalid') {
      errors.push(`Riga ${rowNumber}: il prezzo "${value('price')}" non è un numero.`);
      return;
    }

    const character: Character = { id: characterIdOf(name), name };
    if (price !== undefined) {
      character.price = price;
    }
    if (YES.has(normalize(value('possibleStarter')))) {
      character.possibleStarter = true;
    }
    if (YES.has(normalize(value('shopkeeper')))) {
      character.shopkeeper = true;
    }
    if (YES.has(normalize(value('villain')))) {
      character.villain = true;
    }
    for (const column of ['tier', 'person', 'saga', 'race', 'info', 'image'] as const) {
      const text = value(column);
      if (text) {
        character[column] = text;
      }
    }
    const fight = readSheet(value, (problem) => sheetProblems.push(`${name}: ${problem}`));
    if (fight) {
      character.fight = fight;
    }
    if (value('transformsInto')) {
      transforms.push({ character, target: value('transformsInto') });
    }
    catalog.push(character);
  });

  const duplicates = findDuplicates(catalog);
  if (duplicates.length > 0) {
    errors.push(`Nomi doppi: ${duplicates.join(', ')}.`);
  }
  if (errors.length === 0 && catalog.length === 0) {
    // Only titles: keep the current list instead of replacing it with nothing.
    errors.push("Il file non contiene personaggi: c'è solo la riga dei titoli.");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  linkTransformations(catalog, transforms, sheetProblems);
  return { ok: true, catalog, summary: summarizeCatalog(catalog), sheetProblems };
}

const NUMBER_COLUMNS = [
  ['bars', 'barre', 3, 5],
  ['power', 'potenza', 1, 5],
  ['speed', 'velocità', 1, 5],
] as const;

const MOVE_COLUMNS = [
  ['move1', 'mossa 1'],
  ['move2', 'mossa 2'],
  ['finale', 'mossa finale'],
] as const;

/** The sheet columns of a row; undefined when they are all empty. */
function readSheet(
  value: (column: Column) => string,
  problem: (text: string) => void,
): FightSheet | undefined {
  const sheet: FightSheet = {};
  for (const [column, label, min, max] of NUMBER_COLUMNS) {
    const text = value(column);
    if (!text) {
      continue;
    }
    const number = Number(text);
    if (Number.isInteger(number) && number >= min && number <= max) {
      sheet[column] = number;
    } else {
      problem(`${label} «${text}», va da ${min} a ${max}`);
    }
  }
  if (YES.has(normalize(value('giant')))) {
    sheet.giant = true;
  }
  const heal = value('transformHeal');
  if (heal) {
    const hp = parsePrice(heal);
    if (typeof hp === 'number' && hp > 0) {
      sheet.transformHeal = hp;
    } else {
      problem(`cura trasformandosi «${heal}», va un numero di HP, es. «2.500»`);
    }
  }
  for (const [column, label] of MOVE_COLUMNS) {
    const text = value(column);
    if (!text) {
      continue;
    }
    const move = parseMove(text);
    if (move) {
      sheet[column] = move;
    } else {
      problem(`${label} «${text}» senza tipo, es. «Kamehameha (onda)» o «Meteor Smash (impeto)»`);
    }
  }
  return Object.keys(sheet).length > 0 ? sheet : undefined;
}

/**
 * "Kamehameha (onda)", "Meteor Smash (impeto)", "Penetrate! (impeto, giganti)",
 * "Drain Life 19 (impeto, risucchio)" (spec 073); null without a type.
 */
export function parseMove(text: string): FightMove | null {
  const match = /^(.+?)\s*\(\s*(onda|impeto)((?:\s*,\s*(?:giganti|risucchio))*)\s*\)$/i.exec(text.trim());
  if (!match) {
    return null;
  }
  const kind = (match[2] as string).toLowerCase() === 'onda' ? 'wave' : 'rush';
  const flags = (match[3] as string).toLowerCase();
  const move: FightMove = { name: (match[1] as string).trim(), kind };
  if (kind === 'rush' && flags.includes('giganti')) {
    move.hitsGiants = true;
  }
  if (flags.includes('risucchio')) {
    move.drains = true;
  }
  return move;
}

/**
 * "si trasforma in" leads to a character of the list with a tier, and no
 * chain comes back on itself (spec 037, criterion 3); otherwise it counts
 * as empty.
 */
function linkTransformations(
  catalog: Character[],
  transforms: { character: Character; target: string }[],
  problems: string[],
): void {
  const byId = new Map(catalog.map((character) => [character.id, character]));
  for (const { character, target } of transforms) {
    const next = byId.get(characterIdOf(target));
    if (!next || !next.tier || next === character) {
      problems.push(`${character.name}: si trasforma in «${target}», che non è un personaggio della lista con un tier`);
    } else {
      character.fight = { ...character.fight, transformsInto: next.id };
    }
  }
  const inLoop = catalog.filter((character) => {
    let next = character.fight?.transformsInto;
    for (let step = 0; next !== undefined && step < catalog.length; step++) {
      if (next === character.id) {
        return true;
      }
      next = byId.get(next)?.fight?.transformsInto;
    }
    return false;
  });
  for (const character of inLoop) {
    problems.push(`${character.name}: le sue trasformazioni tornano su sé stesse`);
    const rest: FightSheet = { ...character.fight };
    delete rest.transformsInto;
    if (Object.keys(rest).length > 0) {
      character.fight = rest;
    } else {
      delete character.fight;
    }
  }
}

export function summarizeCatalog(catalog: Character[]): CatalogSummary {
  return {
    count: catalog.length,
    possibleStarters: catalog.filter((character) => character.possibleStarter).length,
    priced: catalog.filter((character) => character.price !== undefined).length,
    shopkeepers: catalog.filter((character) => character.shopkeeper).length,
    withoutTier: catalog.filter((character) => !character.tier).length,
  };
}

/** Empty or "1.900"-style thousands become a number; anything else is invalid. */
function parsePrice(text: string): number | undefined | 'invalid' {
  const compact = text.replace(/\s/g, '');
  if (compact === '') {
    return undefined;
  }
  const digits = /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact;
  return /^\d+$/.test(digits) ? Number(digits) : 'invalid';
}

/** Names that would give the same identifier, such as "Metà" and "Meta". */
function findDuplicates(catalog: Character[]): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const character of catalog) {
    const first = seen.get(character.id);
    if (first !== undefined) {
      duplicates.push(first === character.name ? first : `${first} / ${character.name}`);
    } else {
      seen.set(character.id, character.name);
    }
  }
  return duplicates;
}

function isBlank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

/** Lowercase, no accents, single spaces: "Possibile  Starter" -> "possibile starter". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .trim();
}

/** Identifier from the name: "Son Goku (metà) SSJ" -> "son-goku-meta-ssj". */
/** The code of a character, from its name: "Son Goku (metà)" → "son-goku-meta". */
export function characterIdOf(name: string): string {
  return normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

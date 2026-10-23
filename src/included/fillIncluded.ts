import { GUESTS } from '../catalog/guests';
import type { Character, FightMove, FightSheet } from '../engine';
import { hasStoredCatalog, loadCatalog, saveCatalog } from '../storage/catalogStore';
import { loadMissionCatalog, loadQuestions, saveMissionCatalog, saveQuestions } from '../storage/missionStore';
import { missionsFingerprint, pricesFingerprint, questionsFingerprint, sheetFingerprint } from './fingerprint';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

/**
 * The fingerprints of the included missions of before (codes left out): a
 * browser that still has one of those lists, never changed, gets the new one
 * (spec 063 and 066, 2.3: more coins; spec 069, 2.6: the story missions; spec 071: more chains;
 * spec 074, 2.7: the guests; spec 079: the lines of the characters who do not speak; spec 084: «ripassa»). Any other
 * list stays as it is.
 *
 * Spec 079 (D-103): the fingerprints of before are those of the lists with «Babidi» in place of
 * «Bobbidi», as the browsers keep them once their database is renamed (version 12).
 */
export const MISSIONS_BEFORE_063 = 'ac97f167';
export const MISSIONS_BEFORE_066 = 'eadf9369';
export const MISSIONS_BEFORE_069 = '206a3dec';
export const MISSIONS_BEFORE_071 = '56cf8b91';
export const MISSIONS_BEFORE_074 = 'd7acf173';
export const MISSIONS_BEFORE_079 = '15c3e083';
export const MISSIONS_BEFORE_084 = '627c29a2';
const OLD_MISSIONS = [
  MISSIONS_BEFORE_063,
  MISSIONS_BEFORE_066,
  MISSIONS_BEFORE_069,
  MISSIONS_BEFORE_071,
  MISSIONS_BEFORE_074,
  MISSIONS_BEFORE_079,
  MISSIONS_BEFORE_084,
];

/** The included questions of before spec 074, never changed: they get the guests' ones (spec 074, 2.7). */
export const QUESTIONS_BEFORE_074 = 'e074236a';

/**
 * The fingerprint of codes and prices of the included characters before
 * spec 066: a character list with all of them unchanged gets the new prices,
 * and keeps everything else (spec 066, 2.3).
 */
export const PRICES_BEFORE_066 = 'c1cf89be';

export interface FilledLists {
  /** The character list to use: the browser's, or the included one just saved. */
  catalog: Character[] | null;
  /** What came from the included files, e.g. ['missioni']. */
  filled: string[];
}

/**
 * At start (spec 030, D-045): what the browser does not have comes from the
 * files of the project; what it has is never touched, except the included
 * missions, prices, sheets and questions of before, never changed, which get
 * the new values (spec 063, 066, 073 and 074), and the guests, who come with
 * the new missions (spec 074).
 */
export async function fillMissingLists(): Promise<FilledLists> {
  const filled: string[] = [];
  let catalog = await loadCatalog();
  if (!(await hasStoredCatalog())) {
    catalog = includedCatalog();
    await saveCatalog(catalog);
    filled.push('lista dei personaggi');
  } else if (catalog && pricesFingerprint(catalog) === PRICES_BEFORE_066) {
    catalog = withPricesOf(catalog, includedCatalog());
    await saveCatalog(catalog);
    filled.push('prezzi aggiornati');
  }
  const drains = catalog ? withDrainsOf(catalog, includedCatalog()) : null;
  if (drains) {
    catalog = drains;
    await saveCatalog(catalog);
    filled.push('schede aggiornate');
  }
  // The names of the missions refer to the list: without a readable one they cannot be read.
  if (catalog) {
    const stored = await loadMissionCatalog();
    if (stored.length === 0) {
      await saveMissionCatalog(includedMissions(catalog));
      filled.push('missioni');
    } else if (OLD_MISSIONS.includes(missionsFingerprint(stored))) {
      // The guests come with their missions, once (spec 074, 2.7).
      const withGuests = withGuestsOf(catalog, includedCatalog());
      if (withGuests) {
        catalog = withGuests;
        await saveCatalog(catalog);
        filled.push('Livio, Maggi e Meliador');
      }
      await saveMissionCatalog(includedMissions(catalog));
      filled.push('missioni aggiornate');
    }
  }
  const questions = await loadQuestions();
  if (questions.length === 0) {
    await saveQuestions(includedQuestions());
    filled.push('domande');
  } else if (questionsFingerprint(questions) === QUESTIONS_BEFORE_074) {
    await saveQuestions(includedQuestions());
    filled.push('domande aggiornate');
  }
  return { catalog, filled };
}

/**
 * Spec 073, 2.8: a character whose sheet is still the included one of
 * before, without drains and «cura trasformandosi», gets the new one; any
 * sheet changed by the host stays as it is. Null when nothing changes.
 */
export function withDrainsOf(catalog: Character[], included: Character[]): Character[] | null {
  const sheets = new Map(included.map((character) => [character.id, character.fight]));
  let changed = false;
  const result = catalog.map((character) => {
    const sheet = sheets.get(character.id);
    if (!sheet || sheetFingerprint(character.fight) === sheetFingerprint(sheet)) {
      return character;
    }
    if (sheetFingerprint(character.fight) !== sheetFingerprint(withoutDrains(sheet))) {
      return character;
    }
    changed = true;
    return { ...character, fight: sheet };
  });
  return changed ? result : null;
}

/** The sheet as it was before spec 073: no drains, no «cura trasformandosi». */
function withoutDrains(sheet: FightSheet): FightSheet {
  const plain = (move: FightMove | undefined): FightMove | undefined => {
    if (!move) {
      return undefined;
    }
    const { drains: _drains, ...rest } = move;
    return rest;
  };
  const { transformHeal: _heal, ...rest } = sheet;
  return { ...rest, move1: plain(sheet.move1), move2: plain(sheet.move2), finale: plain(sheet.finale) };
}

/** The list with the guests of `included` it lacks (spec 074, 2.7); null when it has them all. */
export function withGuestsOf(catalog: Character[], included: Character[]): Character[] | null {
  const known = new Set(catalog.map((character) => character.id));
  const missing = included.filter((character) => GUESTS.includes(character.id) && !known.has(character.id));
  return missing.length > 0 ? [...catalog, ...missing] : null;
}

/** The list with the prices of `included`, character by character; the rest as it was. */
export function withPricesOf(catalog: Character[], included: Character[]): Character[] {
  const prices = new Map(included.map((character) => [character.id, character.price]));
  return catalog.map((character) => {
    const price = prices.get(character.id);
    return price === undefined ? character : { ...character, price };
  });
}

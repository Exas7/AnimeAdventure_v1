import type { Character, FightMove, FightSheet } from '../engine';
import { hasStoredCatalog, loadCatalog, saveCatalog } from '../storage/catalogStore';
import { loadMissionCatalog, loadQuestions, saveMissionCatalog, saveQuestions } from '../storage/missionStore';
import { missionsFingerprint, pricesFingerprint, sheetFingerprint } from './fingerprint';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

/**
 * The fingerprints of the included missions of before (codes left out): a
 * browser that still has one of those lists, never changed, gets the new one
 * (spec 063 and 066, 2.3: more coins; spec 069, 2.6: the story missions; spec 071: more chains).
 * Any other list stays as it is.
 */
export const MISSIONS_BEFORE_063 = '06dfb42d';
export const MISSIONS_BEFORE_066 = '21906f4f';
export const MISSIONS_BEFORE_069 = 'd7074836';
export const MISSIONS_BEFORE_071 = '440cbbd5';
const OLD_MISSIONS = [MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069, MISSIONS_BEFORE_071];

/**
 * The fingerprint of codes and prices of the included characters before
 * spec 066: a character list with all of them unchanged gets the new prices,
 * and keeps everything else (spec 066, 2.3).
 */
export const PRICES_BEFORE_066 = 'bc4e6e98';

export interface FilledLists {
  /** The character list to use: the browser's, or the included one just saved. */
  catalog: Character[] | null;
  /** What came from the included files, e.g. ['missioni']. */
  filled: string[];
}

/**
 * At start (spec 030, D-045): what the browser does not have comes from the
 * files of the project; what it has is never touched, except the included
 * missions, prices and sheets of before, never changed, which get the new
 * values (spec 063, 066 and 073).
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
      await saveMissionCatalog(includedMissions(catalog));
      filled.push('missioni aggiornate');
    }
  }
  if ((await loadQuestions()).length === 0) {
    await saveQuestions(includedQuestions());
    filled.push('domande');
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

/** The list with the prices of `included`, character by character; the rest as it was. */
export function withPricesOf(catalog: Character[], included: Character[]): Character[] {
  const prices = new Map(included.map((character) => [character.id, character.price]));
  return catalog.map((character) => {
    const price = prices.get(character.id);
    return price === undefined ? character : { ...character, price };
  });
}

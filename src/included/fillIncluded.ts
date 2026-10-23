import type { Character } from '../engine';
import { hasStoredCatalog, loadCatalog, saveCatalog } from '../storage/catalogStore';
import { loadMissionCatalog, loadQuestions, saveMissionCatalog, saveQuestions } from '../storage/missionStore';
import { missionsFingerprint, pricesFingerprint } from './fingerprint';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

/**
 * The fingerprints of the included missions of before (codes left out): a
 * browser that still has one of those lists, never changed, gets the new one
 * (spec 063 and 066, 2.3: more coins; spec 069, 2.6: the story missions).
 * Any other list stays as it is.
 */
export const MISSIONS_BEFORE_063 = '06dfb42d';
export const MISSIONS_BEFORE_066 = '21906f4f';
export const MISSIONS_BEFORE_069 = 'd7074836';
const OLD_MISSIONS = [MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069];

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
 * missions and prices of before, never changed, which get the new values
 * (spec 063 and 066).
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

/** The list with the prices of `included`, character by character; the rest as it was. */
export function withPricesOf(catalog: Character[], included: Character[]): Character[] {
  const prices = new Map(included.map((character) => [character.id, character.price]));
  return catalog.map((character) => {
    const price = prices.get(character.id);
    return price === undefined ? character : { ...character, price };
  });
}

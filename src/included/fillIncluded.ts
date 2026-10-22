import type { Character } from '../engine';
import { hasStoredCatalog, loadCatalog, saveCatalog } from '../storage/catalogStore';
import { loadMissionCatalog, loadQuestions, saveMissionCatalog, saveQuestions } from '../storage/missionStore';
import { missionsFingerprint } from './fingerprint';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

/**
 * The fingerprint of the included missions before spec 063 (codes left
 * out): a browser that still has that list, never changed, gets the new one
 * with more coins (spec 063, 2.3). Any other list stays as it is.
 */
export const MISSIONS_BEFORE_063 = '06dfb42d';

export interface FilledLists {
  /** The character list to use: the browser's, or the included one just saved. */
  catalog: Character[] | null;
  /** What came from the included files, e.g. ['missioni']. */
  filled: string[];
}

/**
 * At start (spec 030, D-045): what the browser does not have comes from the
 * files of the project; what it has is never touched, except the included
 * missions of before spec 063, never changed, which get the new coins.
 */
export async function fillMissingLists(): Promise<FilledLists> {
  const filled: string[] = [];
  let catalog = await loadCatalog();
  if (!(await hasStoredCatalog())) {
    catalog = includedCatalog();
    await saveCatalog(catalog);
    filled.push('lista dei personaggi');
  }
  // The names of the missions refer to the list: without a readable one they cannot be read.
  if (catalog) {
    const stored = await loadMissionCatalog();
    if (stored.length === 0) {
      await saveMissionCatalog(includedMissions(catalog));
      filled.push('missioni');
    } else if (missionsFingerprint(stored) === MISSIONS_BEFORE_063) {
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

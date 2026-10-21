import type { Character } from '../engine';
import { hasStoredCatalog, loadCatalog, saveCatalog } from '../storage/catalogStore';
import { loadMissionCatalog, loadQuestions, saveMissionCatalog, saveQuestions } from '../storage/missionStore';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

export interface FilledLists {
  /** The character list to use: the browser's, or the included one just saved. */
  catalog: Character[] | null;
  /** What came from the included files, e.g. ['missioni']. */
  filled: string[];
}

/**
 * At start (spec 030, D-045): what the browser does not have comes from the
 * files of the project; what it has is never touched.
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
  if (catalog && (await loadMissionCatalog()).length === 0) {
    await saveMissionCatalog(includedMissions(catalog));
    filled.push('missioni');
  }
  if ((await loadQuestions()).length === 0) {
    await saveQuestions(includedQuestions());
    filled.push('domande');
  }
  return { catalog, filled };
}

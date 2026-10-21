import { importCatalog } from '../catalog/importCatalog';
import { testItems, type Character } from '../engine';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { catalogFromCsv, questionsFromCsv } from '../missions/catalogCsv';
import charactersCsv from '../../docs/personaggi-bt3.csv?raw';
import missionsCsv from '../../docs/missioni-bt3.csv?raw';
import questionsCsv from '../../docs/domande.csv?raw';

// The lists that come with the app (spec 030, D-045): the files of docs/,
// read as "Importa" would read them, for a browser that has none.

/** The character list of the project. A broken file is a mistake in the project: it throws. */
export function includedCatalog(): Character[] {
  const result = importCatalog(charactersCsv);
  if (!result.ok) {
    throw new Error(`La lista dei personaggi inclusa non si legge: ${result.errors.join(' ')}`);
  }
  return result.catalog;
}

/** The mission catalog of the project; the names refer to `characters`. */
export function includedMissions(characters: Character[]): CatalogMission[] {
  return catalogFromCsv(missionsCsv, characters, testItems).entries;
}

export function includedQuestions(): QuestionEntry[] {
  return questionsFromCsv(questionsCsv).entries;
}

import {
  looksLikeCatalogMission,
  looksLikeQuestion,
  type CatalogMission,
  type QuestionEntry,
} from '../missions/catalog';
import { withStore } from './database';

// The catalog of missions and the quiz questions in the browser (D-041):
// one list each, replaced whole by an import from Excel. Unreadable entries
// are skipped.

const KEY = 'current';

export async function loadMissionCatalog(): Promise<CatalogMission[]> {
  const value = await withStore<unknown>('missions', 'readonly', (store) => store.get(KEY));
  return Array.isArray(value) ? value.filter(looksLikeCatalogMission) : [];
}

export async function saveMissionCatalog(catalog: CatalogMission[]): Promise<void> {
  await withStore('missions', 'readwrite', (store) => store.put(catalog, KEY));
}

export async function loadQuestions(): Promise<QuestionEntry[]> {
  const value = await withStore<unknown>('questions', 'readonly', (store) => store.get(KEY));
  return Array.isArray(value) ? value.filter(looksLikeQuestion) : [];
}

export async function saveQuestions(questions: QuestionEntry[]): Promise<void> {
  await withStore('questions', 'readwrite', (store) => store.put(questions, KEY));
}

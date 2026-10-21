import { EMPTY_TEXT_LIBRARY, readTextLibrary, type TextLibrary } from '../episode/textLibrary';
import { withStore } from './database';

// Lines remembered while preparing episodes (spec 007, 2.5; D-031).

const KEY = 'library';

export async function loadTexts(): Promise<TextLibrary> {
  const value = await withStore<unknown>('texts', 'readonly', (store) => store.get(KEY));
  return readTextLibrary(value) ?? EMPTY_TEXT_LIBRARY;
}

export async function saveTexts(library: TextLibrary): Promise<void> {
  await withStore('texts', 'readwrite', (store) => store.put(library, KEY));
}

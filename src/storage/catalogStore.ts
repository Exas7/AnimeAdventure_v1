import type { Character } from '../engine';
import { withStore } from './database';

// The imported character list (D-017): kept in the browser and used for new
// games until the next import. Each game also keeps its own copy.

const KEY = 'imported-catalog';

export async function saveCatalog(catalog: Character[]): Promise<void> {
  await withStore('catalog', 'readwrite', (store) => store.put(catalog, KEY));
}

/** The imported catalog, or null when none was imported (or it is unreadable). */
export async function loadCatalog(): Promise<Character[] | null> {
  const value = await withStore<unknown>('catalog', 'readonly', (store) => store.get(KEY));
  return isCatalog(value) ? value : null;
}

/** True when a list was ever saved, even one this app can no longer read: it is left alone (D-045). */
export async function hasStoredCatalog(): Promise<boolean> {
  const value = await withStore<unknown>('catalog', 'readonly', (store) => store.get(KEY));
  return value !== undefined;
}

function isCatalog(value: unknown): value is Character[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string',
    )
  );
}

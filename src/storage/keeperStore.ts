import type { Character } from '../engine';
import { looksLikeSpecialKeeper } from '../catalog/specialKeepers';
import { withStore } from './database';

// The special shopkeepers in the browser (D-035): apart from the character
// list, so importing another list leaves them as they are.

interface KeeperEntry {
  keeper: Character;
  createdAt: number;
}

/** The special shopkeepers, oldest first. Unreadable entries are skipped. */
export async function listSpecialKeepers(): Promise<Character[]> {
  const values = await withStore<unknown[]>('keepers', 'readonly', (store) => store.getAll());
  return values
    .filter(isEntry)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((entry) => entry.keeper);
}

export async function saveSpecialKeeper(keeper: Character, createdAt = Date.now()): Promise<void> {
  const entry: KeeperEntry = { keeper, createdAt };
  await withStore('keepers', 'readwrite', (store) => store.put(entry, keeper.id));
}

export async function deleteSpecialKeeper(id: string): Promise<void> {
  await withStore('keepers', 'readwrite', (store) => store.delete(id));
}

function isEntry(value: unknown): value is KeeperEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<KeeperEntry>;
  return typeof entry.createdAt === 'number' && looksLikeSpecialKeeper(entry.keeper);
}

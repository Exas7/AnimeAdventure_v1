import { looksLikeReadyPower, type ReadyPower } from '../starters/readyPowers';
import { withStore } from './database';

// The list of ready powers in the browser (D-037): apart from the character
// list, so importing another list leaves it as it is.

/** Same shape as the entries the database puts in the first time (database.ts). */
export interface PowerEntry {
  power: ReadyPower;
  createdAt: number;
}

/** The ready powers, oldest first. Unreadable entries are skipped. */
export async function listReadyPowers(): Promise<ReadyPower[]> {
  const values = await withStore<unknown[]>('powers', 'readonly', (store) => store.getAll());
  return values
    .filter(isEntry)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((entry) => entry.power);
}

export async function saveReadyPower(power: ReadyPower, createdAt = Date.now()): Promise<void> {
  const entry: PowerEntry = { power, createdAt };
  await withStore('powers', 'readwrite', (store) => store.put(entry, power.id));
}

/**
 * Editing makes a new version (spec 025, 2.1): the new one takes the old
 * one's place in the list, and episodes keep their copy of the old one.
 */
export async function replaceReadyPower(oldId: string, next: ReadyPower): Promise<void> {
  const old = await withStore<unknown>('powers', 'readonly', (store) => store.get(oldId));
  await saveReadyPower(next, isEntry(old) ? old.createdAt : Date.now());
  await deleteReadyPower(oldId);
}

export async function deleteReadyPower(id: string): Promise<void> {
  await withStore('powers', 'readwrite', (store) => store.delete(id));
}

function isEntry(value: unknown): value is PowerEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<PowerEntry>;
  return typeof entry.createdAt === 'number' && looksLikeReadyPower(entry.power);
}

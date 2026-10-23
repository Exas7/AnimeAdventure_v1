import {
  DEFAULT_READY_POWERS,
  DOUBLE_ACTION_POWER,
  REPLACED_READY_POWERS,
  REPLACED_READY_POWERS_067,
  RETRY_LOST_CHALLENGE_POWER,
  sameReadyPower,
  SKIP_TURN_POWER,
  type ReadyPower,
} from '../starters/readyPowers';
import { renameBabidi } from './renameBabidi';

// The browser's IndexedDB storage of the app (D-011): one database with a
// store for each kind of data. Version 2 adds the imported catalog (D-017),
// version 3 the map library (D-018), version 4 episodes and remembered
// texts (D-019, spec 007), version 5 put the test map in the library
// (spec 010; new browsers no longer get it since spec 036), version 6 adds the special shopkeepers (D-035), version 7 the
// list of ready powers, which starts with the channel's three (D-037),
// version 8 the catalog of missions and the quiz questions (D-041), version
// 9 the power to retry a lost challenge in the lists made before (D-090),
// version 10 the ready powers of spec 063 in the lists made before,
// version 11 «Doppia azione» in place of «Doppio movimento» (spec 067),
// version 12 «Babidi» in place of «Bobbidi» in everything saved (spec 079).

/** Internal code: stays 'arkanite' after the rename, or saved data would vanish (D-020). */
const DB_NAME = 'arkanite';
const DB_VERSION = 12;

export type StoreName =
  | 'autosave'
  | 'catalog'
  | 'maps'
  | 'episodes'
  | 'texts'
  | 'keepers'
  | 'powers'
  | 'missions'
  | 'questions';
const STORES: StoreName[] = [
  'autosave',
  'catalog',
  'maps',
  'episodes',
  'texts',
  'keepers',
  'powers',
  'missions',
  'questions',
];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
      // Once per browser: the list of powers starts with the ready ones of the
      // channel's graphic (spec 025, 2.1; spec 061); deleted ones do not come back.
      // Same shape as the entries of powerStore.ts, oldest first.
      if (event.oldVersion < 7) {
        const powers = request.transaction?.objectStore('powers');
        DEFAULT_READY_POWERS.forEach((power, index) =>
          powers?.put({ power, createdAt: index + 1 }, power.id),
        );
      }
      // Once per browser used before (spec 061, 2.2): the power to retry a
      // lost challenge joins the list, last; a new browser had it above.
      if (event.oldVersion >= 7 && event.oldVersion < 9) {
        request.transaction
          ?.objectStore('powers')
          .put({ power: RETRY_LOST_CHALLENGE_POWER, createdAt: Date.now() }, RETRY_LOST_CHALLENGE_POWER.id);
      }
      // Once per browser used before (spec 063, 2.3): the ready powers the app
      // put there and nobody changed take their new values, in the same place;
      // «Doppia azione» (since spec 067) and «Salta turno» join the list, last.
      if (event.oldVersion >= 7 && event.oldVersion < 10) {
        const powers = request.transaction?.objectStore('powers');
        replaceUnchanged(powers, REPLACED_READY_POWERS);
        [DOUBLE_ACTION_POWER, SKIP_TURN_POWER].forEach((power, index) =>
          powers?.put({ power, createdAt: Date.now() + index }, power.id),
        );
      }
      // Once per browser that had version 10 (spec 067, 2.2): «Doppio movimento»,
      // unchanged, becomes «Doppia azione» in the same place.
      if (event.oldVersion === 10) {
        replaceUnchanged(request.transaction?.objectStore('powers'), REPLACED_READY_POWERS_067);
      }
      // Once per browser used before (spec 079, 2.2): «Bobbidi» becomes «Babidi»
      // in every store, codes included.
      if (event.oldVersion >= 1 && event.oldVersion < 12) {
        for (const store of STORES) {
          renameInStore(request.transaction?.objectStore(store));
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open IndexedDB'));
  });
}

/** Every value of the store rewritten with the new spelling, under the same key. */
function renameInStore(store: IDBObjectStore | undefined): void {
  const cursorRequest = store?.openCursor();
  if (!cursorRequest) {
    return;
  }
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.update(renameBabidi(cursor.value));
      cursor.continue();
    }
  };
}

/** Each old ready power still as the app put it takes the place of the new one; changed ones stay. */
function replaceUnchanged(powers: IDBObjectStore | undefined, pairs: [ReadyPower, ReadyPower][]): void {
  for (const [old, next] of pairs) {
    const read = powers?.get(old.id);
    if (read) {
      read.onsuccess = () => {
        const entry = read.result as { power?: ReadyPower; createdAt?: number } | undefined;
        if (entry?.power && sameReadyPower(entry.power, old)) {
          powers?.delete(old.id);
          powers?.put({ power: next, createdAt: entry.createdAt ?? Date.now() }, next.id);
        }
      };
    }
  }
}

export async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      // Resolve only once the transaction is complete, so a write is really stored.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(transaction.error ?? request.error ?? new Error('IndexedDB request failed'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

// One director window at a time (spec 032, D-049): the window that holds
// Chrome's lock (Web Locks) is the director; the others show a message and
// take the lock only with "Usa questa finestra".

const DIRECTOR_LOCK = 'arkanite-director';

/** The part of the browser's lock manager used here: navigator.locks. */
export interface DirectorLocks {
  request(
    name: string,
    options: { ifAvailable?: boolean; steal?: boolean },
    callback: (lock: unknown) => unknown,
  ): Promise<unknown>;
}

/**
 * 'checking' until the browser answers; 'elsewhere' when another window is
 * the director; 'taken' when another window took it from this one.
 */
export type DirectorStatus = 'checking' | 'active' | 'elsewhere' | 'taken';

export interface DirectorWindow {
  status(): DirectorStatus;
  subscribe(listener: () => void): () => void;
  /** "Usa questa finestra": this window becomes the director, the other one stops. */
  takeOver(): void;
}

/** Asks for the lock as soon as it is made. Without Web Locks, the window is the director, as before spec 032. */
export function directorWindow(locks: DirectorLocks | undefined): DirectorWindow {
  let status: DirectorStatus = locks ? 'checking' : 'active';
  const listeners = new Set<() => void>();
  const set = (next: DirectorStatus) => {
    status = next;
    listeners.forEach((listener) => listener());
  };

  const claim = (steal: boolean) => {
    if (!locks) {
      return;
    }
    locks
      .request(DIRECTOR_LOCK, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          set('elsewhere');
          return undefined;
        }
        set('active');
        // Held as long as the window is open, or until another one takes it.
        return new Promise<void>(() => undefined);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: unknown } | null)?.name === 'AbortError') {
          // Another window pressed "Usa questa finestra".
          set('taken');
        } else {
          // The browser refused the lock: better a director than a blocked window.
          set('active');
        }
      });
  };

  claim(false);
  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    takeOver: () => claim(true),
  };
}

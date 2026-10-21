import { describe, expect, it } from 'vitest';
import { directorWindow, type DirectorLocks } from './directorLock';

/** One Chrome with its lock: the windows ask for it, "close" lets it go. Answers come later, as in Chrome. */
function fakeChrome() {
  let holder: { window: number; reject(cause: unknown): void } | null = null;
  return {
    window(id: number): DirectorLocks {
      return {
        request(_name, options, callback) {
          if (holder && options.ifAvailable) {
            return Promise.resolve().then(() => callback(null));
          }
          if (holder && options.steal) {
            holder.reject(new DOMException('The lock was stolen', 'AbortError'));
          }
          return new Promise((resolve, reject) => {
            holder = { window: id, reject };
            Promise.resolve()
              .then(() => callback({ name: 'arkanite-director' }))
              .then(resolve, reject);
          });
        },
      };
    },
    close(id: number) {
      if (holder?.window === id) {
        holder = null;
      }
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('one director window (spec 032)', () => {
  it('the first window is the director, a second one is not (criterion 1)', async () => {
    const chrome = fakeChrome();
    const first = directorWindow(chrome.window(1));
    expect(first.status()).toBe('checking');
    await settle();
    expect(first.status()).toBe('active');
    const second = directorWindow(chrome.window(2));
    await settle();
    expect(second.status()).toBe('elsewhere');
    expect(first.status()).toBe('active');
  });

  it('"Usa questa finestra" moves the director here and the other window knows; it can take it back (criterion 2)', async () => {
    const chrome = fakeChrome();
    const first = directorWindow(chrome.window(1));
    await settle();
    const second = directorWindow(chrome.window(2));
    await settle();
    let told = 0;
    first.subscribe(() => told++);
    second.takeOver();
    await settle();
    expect(second.status()).toBe('active');
    expect(first.status()).toBe('taken');
    expect(told).toBeGreaterThan(0);
    first.takeOver();
    await settle();
    expect(first.status()).toBe('active');
    expect(second.status()).toBe('taken');
  });

  it('once the director window is closed, the next one to open is the director (criterion 3)', async () => {
    const chrome = fakeChrome();
    directorWindow(chrome.window(1));
    await settle();
    chrome.close(1);
    const next = directorWindow(chrome.window(2));
    await settle();
    expect(next.status()).toBe('active');
  });

  it('without Web Locks the window is the director, as before', () => {
    expect(directorWindow(undefined).status()).toBe('active');
  });
});

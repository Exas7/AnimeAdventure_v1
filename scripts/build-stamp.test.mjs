import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_INPUTS, fingerprint, listFiles, needsUpdate, save } from './build-stamp.mjs';

const roots = [];
function project() {
  const root = mkdtempSync(join(tmpdir(), 'impronta-'));
  roots.push(root);
  const write = (name, text) => {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), text);
  };
  write('src/main.tsx', 'codice');
  write('assets/maps/Nameck.jpg', 'immagine');
  write('docs/personaggi-bt3.csv', 'nome;tier');
  write('docs/specifiche-progetto.md', 'appunti');
  write('package.json', '{}');
  write('package-lock.json', '{}');
  write('dist/index.html', 'app');
  write('node_modules/vite/package.json', '{}');
  return { root, write };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('the launcher rebuilds only when needed (spec 038, criterion 3)', () => {
  it('in docs/ only the lists count', () => {
    const { root } = project();
    expect(listFiles(root, APP_INPUTS)).toEqual([
      'assets/maps/Nameck.jpg',
      'docs/personaggi-bt3.csv',
      'package-lock.json',
      'package.json',
      'src/main.tsx',
    ]);
  });

  it('nothing remembered: build; remembered and unchanged: no build', () => {
    const { root } = project();
    expect(needsUpdate(root, 'app')).toBe(true);
    save(root, 'app');
    expect(needsUpdate(root, 'app')).toBe(false);
  });

  it('a changed code file, asset or list means a new build; notes do not', () => {
    for (const name of ['src/main.tsx', 'assets/maps/Nameck.jpg', 'docs/personaggi-bt3.csv', 'src/nuovo.ts']) {
      const { root, write } = project();
      save(root, 'app');
      write(name, 'cambiato');
      expect(needsUpdate(root, 'app'), name).toBe(true);
    }
    const { root, write } = project();
    save(root, 'app');
    write('docs/specifiche-progetto.md', 'altri appunti');
    expect(needsUpdate(root, 'app')).toBe(false);
  });

  it('a deleted build means a new build', () => {
    const { root } = project();
    save(root, 'app');
    rmSync(join(root, 'dist', 'index.html'));
    expect(needsUpdate(root, 'app')).toBe(true);
  });

  it('packages: reinstalled only when package.json or the lock file change', () => {
    const { root, write } = project();
    expect(needsUpdate(root, 'packages')).toBe(true);
    save(root, 'packages');
    write('src/main.tsx', 'cambiato');
    expect(needsUpdate(root, 'packages')).toBe(false);
    write('package-lock.json', '{"nuovo": true}');
    expect(needsUpdate(root, 'packages')).toBe(true);
  });

  it('the same files give the same fingerprint', () => {
    const { root } = project();
    expect(fingerprint(root, APP_INPUTS)).toBe(fingerprint(root, APP_INPUTS));
  });
});

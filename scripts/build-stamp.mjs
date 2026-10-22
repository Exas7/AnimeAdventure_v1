// The launcher's memory (spec 038, D-063): rebuild the app or reinstall the
// packages only when something they depend on has changed since last time.
//
//   node scripts/build-stamp.mjs app        exit 0: up to date, 10: rebuild needed
//   node scripts/build-stamp.mjs app --save  remember the current state
//   node scripts/build-stamp.mjs packages [--save]  the same for the packages
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What the built app depends on; in docs/ only the lists (.csv) count. */
export const APP_INPUTS = [
  'src',
  'assets',
  'public',
  'docs',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.engine.json',
  'tsconfig.node.json',
  'package.json',
  'package-lock.json',
];

/** What the installed packages depend on. */
export const PACKAGE_INPUTS = ['package.json', 'package-lock.json'];

const KINDS = {
  app: { inputs: APP_INPUTS, stamp: join('dist', '.impronta'), output: join('dist', 'index.html') },
  packages: { inputs: PACKAGE_INPUTS, stamp: join('node_modules', '.impronta-pacchetti'), output: 'node_modules' },
};

/** Every file under the given inputs, as sorted paths relative to the root. */
export function listFiles(root, inputs) {
  const files = [];
  const walk = (path) => {
    if (!existsSync(path)) {
      return;
    }
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) {
        walk(join(path, name));
      }
      return;
    }
    const name = relative(root, path).split(sep).join('/');
    if (!name.startsWith('docs/') || name.endsWith('.csv')) {
      files.push(name);
    }
  };
  for (const input of inputs) {
    walk(join(root, input));
  }
  return files.sort();
}

/** One fingerprint for the names and contents of the files: it changes when any of them does. */
export function fingerprint(root, inputs) {
  const hash = createHash('sha256');
  for (const name of listFiles(root, inputs)) {
    hash.update(name);
    hash.update('\0');
    hash.update(createHash('sha256').update(readFileSync(join(root, name))).digest('hex'));
    hash.update('\n');
  }
  return hash.digest('hex');
}

/** True when the app (or the packages) must be built (or installed) again. */
export function needsUpdate(root, kind) {
  const { inputs, stamp, output } = KINDS[kind];
  if (!existsSync(join(root, output)) || !existsSync(join(root, stamp))) {
    return true;
  }
  return readFileSync(join(root, stamp), 'utf-8').trim() !== fingerprint(root, inputs);
}

/** Remembers the current state, after a build or an install. */
export function save(root, kind) {
  const { inputs, stamp } = KINDS[kind];
  writeFileSync(join(root, stamp), fingerprint(root, inputs));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [kind, flag] = process.argv.slice(2);
  if (!(kind in KINDS)) {
    console.error('Uso: node scripts/build-stamp.mjs app|packages [--save]');
    process.exit(1);
  }
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  if (flag === '--save') {
    save(root, kind);
    process.exit(0);
  }
  process.exit(needsUpdate(root, kind) ? 10 : 0);
}

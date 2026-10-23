import type { Character, FightSheet } from '../engine';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';

// A short fingerprint of a list, to recognise in a browser the list that
// came from the included files and was never changed (spec 063, 2.3; spec
// 066, 2.3). The codes of the missions are left out: each copy of the list
// draws its own.

/** The same JSON for the same values, whatever the order of the keys. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a, 32 bits, as 8 hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function missionsFingerprint(missions: readonly CatalogMission[]): string {
  return fnv1a(canonical(missions.map(({ id: _id, ...rest }) => rest)));
}

/** The questions, codes left out as for the missions (spec 074, 2.7). */
export function questionsFingerprint(questions: readonly QuestionEntry[]): string {
  return fnv1a(canonical(questions.map(({ id: _id, ...rest }) => rest)));
}

/** A fight sheet of the list (spec 073, 2.8): the same values, the same fingerprint. */
export function sheetFingerprint(sheet: FightSheet | undefined): string {
  return fnv1a(canonical(sheet ?? null));
}

/** Only codes and prices: the other columns of the list grew over time. */
export function pricesFingerprint(catalog: readonly Character[]): string {
  return fnv1a(canonical(catalog.map((character) => [character.id, character.price ?? null])));
}

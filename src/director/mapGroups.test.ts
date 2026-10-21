import { describe, expect, it } from 'vitest';
import {
  MAP_GROUPS,
  orderChoices,
  parseClosedGroups,
  readClosedGroups,
  serializeClosedGroups,
  writeClosedGroups,
  type MapChoice,
} from './mapGroups';

/** A stand-in for Chrome's storage of preferences. */
function memoryPreferences() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const refusing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('the map tiles of "Nuova partita" (spec 033, 2.1)', () => {
  it('Puntate, Le mie mappe, Mappe base, in this order (criterion 1)', () => {
    expect(MAP_GROUPS.map((group) => group.label)).toEqual(['Puntate', 'Le mie mappe', 'Mappe base']);
  });

  it('the first choice proposed follows the same order (criterion 1)', () => {
    const choices: MapChoice[] = [
      { id: 'inclusa:Nameck', name: 'Pianeta Nameck', kind: 'included' },
      { id: 'm1', name: 'Pianeta Nameck', kind: 'map' },
      { id: 'e1', name: 'Pianeta Nameck · 1', kind: 'episode' },
      { id: 'm2', name: 'Isola', kind: 'map' },
    ];
    expect(orderChoices(choices).map((choice) => choice.id)).toEqual(['e1', 'm1', 'm2', 'inclusa:Nameck']);
    expect(orderChoices(choices.filter((choice) => choice.kind === 'included'))[0]?.id).toBe('inclusa:Nameck');
  });

  it('the closed tiles are written and read back (criterion 2)', () => {
    const preferences = memoryPreferences();
    expect(writeClosedGroups(preferences, new Set(['included', 'episode']))).toBe(true);
    expect(readClosedGroups(preferences)).toEqual(new Set(['episode', 'included']));
    writeClosedGroups(preferences, new Set());
    expect(readClosedGroups(preferences)).toEqual(new Set());
  });

  it('nothing written, something damaged or a refusing Chrome: all open (criterion 2)', () => {
    expect(readClosedGroups(memoryPreferences())).toEqual(new Set());
    expect(readClosedGroups(undefined)).toEqual(new Set());
    expect(readClosedGroups(refusing)).toEqual(new Set());
    expect(parseClosedGroups('{not json')).toEqual(new Set());
    expect(parseClosedGroups('{"episode":true}')).toEqual(new Set());
    expect(parseClosedGroups('["map","shop",3]')).toEqual(new Set(['map']));
    expect(writeClosedGroups(refusing, new Set(['map']))).toBe(false);
    expect(writeClosedGroups(undefined, new Set(['map']))).toBe(false);
  });

  it('the same tiles always written in the same order', () => {
    expect(serializeClosedGroups(new Set(['included', 'episode']))).toBe('["episode","included"]');
  });
});

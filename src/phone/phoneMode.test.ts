import { describe, expect, it } from 'vitest';
import { phoneModeFor, pointersOf, readPhonePreference, writePhonePreference } from './phoneMode';

const phone = { touch: true, mouse: false };
const pc = { touch: false, mouse: true };
const touchPc = { touch: true, mouse: true };

describe('the phone version (spec 052, criterion 1)', () => {
  it('«Automatica» turns it on for a touch device without a mouse only', () => {
    expect(phoneModeFor('auto', phone)).toBe(true);
    expect(phoneModeFor('auto', pc)).toBe(false);
    expect(phoneModeFor('auto', touchPc)).toBe(false);
  });

  it('«Sempre» and «Mai» win over what the device is', () => {
    expect(phoneModeFor('on', pc)).toBe(true);
    expect(phoneModeFor('off', phone)).toBe(false);
  });

  it('reads the pointers from the media queries', () => {
    expect(pointersOf((query) => query === '(any-pointer: coarse)')).toEqual(phone);
    expect(pointersOf((query) => query === '(any-pointer: fine)')).toEqual(pc);
  });

  it('remembers the choice in Chrome, automatic when there is none or it cannot be read', () => {
    const stored = new Map<string, string>();
    const preferences = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    };
    expect(readPhonePreference(preferences)).toBe('auto');
    expect(writePhonePreference(preferences, 'on')).toBe(true);
    expect(readPhonePreference(preferences)).toBe('on');

    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPhonePreference(broken)).toBe('auto');
    expect(writePhonePreference(broken, 'off')).toBe(false);
    expect(writePhonePreference(undefined, 'off')).toBe(false);
  });
});

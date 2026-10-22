import { browserPreferences } from '../director/mapGroups';

/** «Versione telefono» in the advanced settings (spec 052, 2.1; D-083). */
export type PhonePreference = 'auto' | 'on' | 'off';

export const PHONE_PREFERENCES: { value: PhonePreference; label: string }[] = [
  { value: 'auto', label: 'Automatica' },
  { value: 'on', label: 'Sempre' },
  { value: 'off', label: 'Mai' },
];

/** What the device has to point with. */
export interface Pointers {
  /** A finger: phones and tablets. */
  touch: boolean;
  /** A mouse or a trackpad. */
  mouse: boolean;
}

/**
 * The phone version is on for a touch device without a mouse, unless the
 * advanced settings say «Sempre» or «Mai» (spec 052, 2.1).
 */
export function phoneModeFor(preference: PhonePreference, pointers: Pointers): boolean {
  if (preference === 'on') {
    return true;
  }
  if (preference === 'off') {
    return false;
  }
  return pointers.touch && !pointers.mouse;
}

/** The pointers of this device, from the browser's media queries. */
export function pointersOf(matches: (query: string) => boolean): Pointers {
  return { touch: matches('(any-pointer: coarse)'), mouse: matches('(any-pointer: fine)') };
}

const PREFERENCE_KEY = 'anime-adventure.phone-version';

type Preferences = Pick<Storage, 'getItem' | 'setItem'>;

export function readPhonePreference(preferences: Preferences | undefined): PhonePreference {
  let stored: string | null;
  try {
    stored = preferences?.getItem(PREFERENCE_KEY) ?? null;
  } catch {
    // Storage that refuses to be read: automatic, as the first time.
    return 'auto';
  }
  return stored === 'on' || stored === 'off' ? stored : 'auto';
}

/** False when Chrome refused: the choice then lasts only until the page reloads. */
export function writePhonePreference(preferences: Preferences | undefined, value: PhonePreference): boolean {
  if (!preferences) {
    return false;
  }
  try {
    preferences.setItem(PREFERENCE_KEY, value);
    return true;
  } catch {
    // Full or blocked storage: only the memory of the choice is lost.
    return false;
  }
}

/** Is this page the phone version? Read once when the page opens. */
export function isPhoneVersion(): boolean {
  const matches = (query: string) => window.matchMedia?.(query).matches ?? false;
  return phoneModeFor(readPhonePreference(browserPreferences()), pointersOf(matches));
}

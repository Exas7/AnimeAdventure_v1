import { browserPreferences } from '../director/mapGroups';

export type ThemeId = 'goku' | 'sfera' | 'aura' | 'shenron' | 'kame';
export type FrameId = 'smussata' | 'tuta' | 'aura';
export type SymbolId = 'kame' | 'kaio' | 'go' | 'ryu' | 'kami' | 'whis';
/** The picture behind the start page menu (spec 050, 2.7). */
export type StartArt = 'shenron' | 'kameHouse';

/** One of the five themes (spec 050, 2.1): its colours live in index.css under its id. */
export interface Theme {
  id: ThemeId;
  number: number;
  name: string;
  description: string;
  frame: FrameId;
  symbol: SymbolId;
  art: StartArt;
}

/** Theme 1, the one of the first start (spec 050, 2.1). */
const FIRST_THEME: Theme = { id: 'goku', number: 1, name: 'Tuta di Goku', description: 'Blu notte e arancio', frame: 'tuta', symbol: 'go', art: 'shenron' };

export const THEMES: readonly Theme[] = [
  FIRST_THEME,
  { id: 'sfera', number: 2, name: 'Sfera del Drago', description: 'Oro, arancio e stelle rosse', frame: 'smussata', symbol: 'ryu', art: 'shenron' },
  { id: 'aura', number: 3, name: 'Aura', description: 'Blu ghiaccio luminoso e arancio', frame: 'aura', symbol: 'kaio', art: 'shenron' },
  { id: 'shenron', number: 4, name: 'Shenron', description: 'Verde drago e arancio', frame: 'tuta', symbol: 'kami', art: 'shenron' },
  { id: 'kame', number: 5, name: 'Kame House', description: 'Mare, tetto rosso e sabbia', frame: 'smussata', symbol: 'kame', art: 'kameHouse' },
];

/** The three window frames (spec 050, 2.2). */
export const FRAMES: readonly { id: FrameId; letter: string; name: string }[] = [
  { id: 'smussata', letter: 'A', name: 'Smussata' },
  { id: 'tuta', letter: 'B', name: 'Tuta e cintura' },
  { id: 'aura', letter: 'C', name: 'Aura' },
];

/** The six symbols of the gi (spec 050, 2.3). */
export const SYMBOLS: readonly { id: SymbolId; name: string; meaning: string }[] = [
  { id: 'kame', name: 'Kame', meaning: 'Kame, «tartaruga»: la scuola del Maestro Muten' },
  { id: 'kaio', name: 'Re Kaioh', meaning: 'Kaiō, «re del mondo»: il simbolo di Re Kaioh' },
  { id: 'go', name: 'Go', meaning: 'Go, «comprendere»: il simbolo di Goku' },
  { id: 'ryu', name: 'Ryū', meaning: 'Ryū, «drago»: per le sfere del drago' },
  { id: 'kami', name: 'Kami', meaning: 'Kami, «dio»: Shenron è il «drago divino» (神龍)' },
  { id: 'whis', name: 'Whis', meaning: 'La firma di Whis (non è un kanji)' },
];

/**
 * What the user chose: the theme, and a frame and a symbol that replace the
 * theme's own in every theme, or null to follow the theme (spec 050, 2.6).
 */
export interface ThemeChoice {
  theme: ThemeId;
  frame: FrameId | null;
  symbol: SymbolId | null;
}

/** The first time: theme 1, with its own frame and symbol (spec 050, 2.1). */
export const DEFAULT_CHOICE: ThemeChoice = { theme: 'goku', frame: null, symbol: null };

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? FIRST_THEME;
}

export function activeFrame(choice: ThemeChoice): FrameId {
  return choice.frame ?? themeById(choice.theme).frame;
}

export function activeSymbol(choice: ThemeChoice): SymbolId {
  return choice.symbol ?? themeById(choice.theme).symbol;
}

/** The choice saved in Chrome; anything unknown counts as not chosen (spec 050, criterion 1). */
export function parseThemeChoice(raw: string | null): ThemeChoice {
  if (raw === null) {
    return DEFAULT_CHOICE;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // Not ours, or damaged: as the first time.
    return DEFAULT_CHOICE;
  }
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_CHOICE;
  }
  const saved = value as Record<string, unknown>;
  return {
    theme: oneOf(saved.theme, THEMES.map((theme) => theme.id)) ?? DEFAULT_CHOICE.theme,
    frame: oneOf(saved.frame, FRAMES.map((frame) => frame.id)),
    symbol: oneOf(saved.symbol, SYMBOLS.map((symbol) => symbol.id)),
  };
}

export function serializeThemeChoice(choice: ThemeChoice): string {
  return JSON.stringify(choice);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((id) => id === value) ?? null;
}

/** Where the choice is kept, with the other interface preferences (D-050). */
export const THEME_KEY = 'anime-adventure:theme';

type Preferences = Pick<Storage, 'getItem' | 'setItem'>;

export function readThemeChoice(preferences: Preferences | undefined = browserPreferences()): ThemeChoice {
  try {
    return parseThemeChoice(preferences?.getItem(THEME_KEY) ?? null);
  } catch {
    // Storage that refuses to be read: as the first time.
    return DEFAULT_CHOICE;
  }
}

/** False when Chrome refused: the theme stays until the window closes. */
export function writeThemeChoice(
  choice: ThemeChoice,
  preferences: Preferences | undefined = browserPreferences(),
): boolean {
  if (!preferences) {
    return false;
  }
  try {
    preferences.setItem(THEME_KEY, serializeThemeChoice(choice));
    return true;
  } catch {
    // Full or blocked storage: only the memory of the choice is lost.
    return false;
  }
}

export type StartBackground = { kind: 'channel'; url: string } | { kind: 'theme'; art: StartArt };

/** The channel's own picture wins (spec 024), otherwise the theme's (spec 050, 2.7). */
export function startBackground(channelImage: string | undefined, theme: ThemeId): StartBackground {
  return channelImage
    ? { kind: 'channel', url: channelImage }
    : { kind: 'theme', art: themeById(theme).art };
}

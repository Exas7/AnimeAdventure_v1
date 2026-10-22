import { describe, expect, it } from 'vitest';
import {
  activeFrame,
  activeSymbol,
  DEFAULT_CHOICE,
  parseThemeChoice,
  readThemeChoice,
  serializeThemeChoice,
  startBackground,
  THEME_KEY,
  THEMES,
  writeThemeChoice,
} from './themes';

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

describe('the themes (spec 050, 2.1)', () => {
  it('five themes, numbered 1 to 5, with their default frame and symbol', () => {
    expect(THEMES.map((theme) => [theme.number, theme.name, theme.frame, theme.symbol])).toEqual([
      [1, 'Tuta di Goku', 'tuta', 'go'],
      [2, 'Sfera del Drago', 'smussata', 'ryu'],
      [3, 'Aura', 'aura', 'kaio'],
      [4, 'Shenron', 'tuta', 'kami'],
      [5, 'Kame House', 'smussata', 'kame'],
    ]);
  });
});

describe('the saved choice (spec 050, criterion 1)', () => {
  it('nothing saved: theme 1 with its own frame and symbol', () => {
    const choice = readThemeChoice(memoryPreferences());
    expect(choice).toEqual(DEFAULT_CHOICE);
    expect([choice.theme, activeFrame(choice), activeSymbol(choice)]).toEqual(['goku', 'tuta', 'go']);
  });

  it('theme, frame and symbol are written and read back', () => {
    const preferences = memoryPreferences();
    expect(writeThemeChoice({ theme: 'kame', frame: 'aura', symbol: 'whis' }, preferences)).toBe(true);
    expect(readThemeChoice(preferences)).toEqual({ theme: 'kame', frame: 'aura', symbol: 'whis' });
  });

  it('unknown values count as not chosen, without errors', () => {
    expect(parseThemeChoice('{"theme":"vegeta","frame":"square","symbol":42}')).toEqual(DEFAULT_CHOICE);
    expect(parseThemeChoice('{"theme":"aura","frame":"none"}')).toEqual({ theme: 'aura', frame: null, symbol: null });
    expect(parseThemeChoice('not json')).toEqual(DEFAULT_CHOICE);
    expect(parseThemeChoice('[1,2]')).toEqual(DEFAULT_CHOICE);
    expect(parseThemeChoice('null')).toEqual(DEFAULT_CHOICE);
  });

  it('a storage that refuses: the first-time choice, and the write says it failed', () => {
    expect(readThemeChoice(refusing)).toEqual(DEFAULT_CHOICE);
    expect(writeThemeChoice({ theme: 'sfera', frame: null, symbol: null }, refusing)).toBe(false);
    expect(writeThemeChoice({ theme: 'sfera', frame: null, symbol: null }, undefined)).toBe(false);
  });

  it('is kept under its own key, as JSON', () => {
    const preferences = memoryPreferences();
    const choice = { theme: 'shenron' as const, frame: null, symbol: 'kaio' as const };
    writeThemeChoice(choice, preferences);
    expect(preferences.getItem(THEME_KEY)).toBe(serializeThemeChoice(choice));
  });
});

describe('frame and symbol in use (spec 050, criterion 2)', () => {
  it("follow the theme until another one is chosen; null follows the theme again", () => {
    expect(activeFrame({ theme: 'aura', frame: null, symbol: null })).toBe('aura');
    expect(activeSymbol({ theme: 'aura', frame: null, symbol: null })).toBe('kaio');
    const chosen = { theme: 'aura' as const, frame: 'tuta' as const, symbol: 'kame' as const };
    expect([activeFrame(chosen), activeSymbol(chosen)]).toEqual(['tuta', 'kame']);
    // The same choice holds in every theme.
    const other = { ...chosen, theme: 'sfera' as const };
    expect([activeFrame(other), activeSymbol(other)]).toEqual(['tuta', 'kame']);
    const back = { ...other, frame: null, symbol: null };
    expect([activeFrame(back), activeSymbol(back)]).toEqual(['smussata', 'ryu']);
  });
});

describe('the start page background (spec 050, criterion 5)', () => {
  it("the channel's picture when there is one, otherwise the theme's", () => {
    expect(startBackground('/assets/pagina-iniziale.jpg', 'kame')).toEqual({
      kind: 'channel',
      url: '/assets/pagina-iniziale.jpg',
    });
    expect(startBackground(undefined, 'goku')).toEqual({ kind: 'theme', art: 'shenron' });
    expect(startBackground(undefined, 'kame')).toEqual({ kind: 'theme', art: 'kameHouse' });
  });
});

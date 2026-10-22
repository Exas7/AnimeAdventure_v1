import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import {
  activeFrame,
  activeSymbol,
  DEFAULT_CHOICE,
  parseThemeChoice,
  readThemeChoice,
  THEME_KEY,
  writeThemeChoice,
  type FrameId,
  type SymbolId,
  type ThemeChoice,
} from './themes';

interface ThemeState {
  choice: ThemeChoice;
  frame: FrameId;
  symbol: SymbolId;
  /** Changes part of the choice: applied at once, remembered in Chrome (spec 050, 2.5). */
  choose(change: Partial<ThemeChoice>): void;
}

const ThemeContext = createContext<ThemeState>({
  choice: DEFAULT_CHOICE,
  frame: activeFrame(DEFAULT_CHOICE),
  symbol: activeSymbol(DEFAULT_CHOICE),
  choose: () => undefined,
});

/**
 * Applies the chosen theme to the whole page (spec 050, D-078): its colours
 * through `data-theme` on the page, frame and symbol through the components.
 * The director and the stream read the same choice, and each follows the
 * other's changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice());

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = choice.theme;
    root.dataset.frame = activeFrame(choice);
  }, [choice]);

  // Chrome tells the other windows when the choice changes: the stream follows the director (criterion 7).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) {
        setChoice(parseThemeChoice(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const choose = useCallback(
    (change: Partial<ThemeChoice>) => {
      const next = { ...choice, ...change };
      setChoice(next);
      writeThemeChoice(next);
    },
    [choice],
  );

  const state = useMemo(
    () => ({ choice, frame: activeFrame(choice), symbol: activeSymbol(choice), choose }),
    [choice, choose],
  );
  return <ThemeContext.Provider value={state}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

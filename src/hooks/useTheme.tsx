import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'azfit-theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setLight: () => void;
  setDark: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setLight: () => {},
  setDark: () => {},
});

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setLight = useCallback(() => {
    setTheme('light');
    localStorage.setItem(STORAGE_KEY, 'light');
  }, []);

  const setDark = useCallback(() => {
    setTheme('dark');
    localStorage.setItem(STORAGE_KEY, 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setLight, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export type { Theme };

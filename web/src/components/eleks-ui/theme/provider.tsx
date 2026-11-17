import { createContext, useEffect, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { eleksLightTheme, eleksDarkTheme } from './eleks-theme';

type ThemeMode = 'light' | 'dark';

export interface EleksUIThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const EleksUIThemeContext =
  createContext<EleksUIThemeContextValue | null>(null);

const storageKey = 'eleks-ui-theme-mode';

function readStoredMode(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null; // storage can be blocked; the choice then just is not remembered
  }
}

export const EleksUIThemeProvider = ({
  children,
  defaultMode = 'light'
}: {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
}) => {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode() ?? defaultMode);

  useEffect(() => {
    document.documentElement.style.colorScheme = mode; // native controls and scrollbars follow the mode
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // not remembered
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev: ThemeMode) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value: EleksUIThemeContextValue = {
    mode,
    toggleTheme,
    setTheme: setMode
  };

  const theme = mode === 'dark' ? eleksDarkTheme : eleksLightTheme;

  return (
    <EleksUIThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </EleksUIThemeContext.Provider>
  );
};

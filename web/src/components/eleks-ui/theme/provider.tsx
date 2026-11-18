import { createContext, useState } from 'react';
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

export const EleksUIThemeProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

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
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </EleksUIThemeContext.Provider>
  );
};

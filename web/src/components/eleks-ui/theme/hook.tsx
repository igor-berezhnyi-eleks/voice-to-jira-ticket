import { useContext } from 'react';
import { EleksUIThemeContext } from './provider';

export const useEleksUITheme = () => {
  const ctx = useContext(EleksUIThemeContext);

  if (!ctx)
    throw new Error('useEleksTheme must be used within EleksUIThemeProvider');

  return ctx;
};

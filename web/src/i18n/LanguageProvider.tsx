import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTheme, ThemeProvider, type Theme } from '@mui/material/styles';
import { enUS, ukUA } from '@mui/material/locale';
import { en, type Dictionary } from './en';
import { readLanguage, writeLanguage } from './languagePreference';
import { defaultLanguage, type LanguageCode } from './languages';
import { uk } from './uk';

const dictionaries: Record<LanguageCode, Dictionary> = { en, uk };
const muiLocales = { en: enUS, uk: ukUA };

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: Dictionary;
}

// Without a provider (component tests mount pages on their own) the UI is English.
const LanguageContext = createContext<LanguageContextValue>({
  language: defaultLanguage,
  setLanguage: () => undefined,
  t: en,
});

/**
 * Holds the UI language, remembers it in `localStorage` (`vtt.language`), keeps `<html lang>` in step and
 * gives MUI's built-in texts the matching locale. Must sit inside the theme provider.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(readLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      t: dictionaries[language],
      setLanguage: (next) => {
        writeLanguage(next);
        setLanguageState(next);
      },
    }),
    [language],
  );

  // Merged into the outer (ELEKS) theme, so colours and component styles stay as they are.
  const mergeLocale = useMemo(() => (outer: Theme) => createTheme(outer, muiLocales[language]), [language]);

  return (
    <LanguageContext.Provider value={value}>
      <ThemeProvider theme={mergeLocale}>{children}</ThemeProvider>
    </LanguageContext.Provider>
  );
}

/** The active dictionary: `const t = useT(); t.generateTicket`. */
export function useT(): Dictionary {
  return useContext(LanguageContext).t;
}

export function useLanguage(): Pick<LanguageContextValue, 'language' | 'setLanguage'> {
  const { language, setLanguage } = useContext(LanguageContext);
  return { language, setLanguage };
}

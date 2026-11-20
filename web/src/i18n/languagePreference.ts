import { defaultLanguage, isLanguageCode, type LanguageCode } from './languages';

export const languageStorageKey = 'vtt.language';

/** The remembered language; an unknown value, or storage that is blocked, gives English. */
export function readLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(languageStorageKey);
    return isLanguageCode(stored) ? stored : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

export function writeLanguage(language: LanguageCode): void {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // not remembered
  }
}

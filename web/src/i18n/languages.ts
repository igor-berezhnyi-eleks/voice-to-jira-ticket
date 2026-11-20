/** The UI languages. `name` is the language's own name, shown in the selector whatever language is active. */
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'uk', name: 'Українська' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

export const defaultLanguage: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return languages.some((language) => language.code === value);
}

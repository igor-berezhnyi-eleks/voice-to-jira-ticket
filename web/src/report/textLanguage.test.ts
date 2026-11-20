import { describe, expect, it } from 'vitest';
import { cyrillicProbeLength, looksCyrillic } from './textLanguage';

describe('looksCyrillic', () => {
  it('is true for Ukrainian text and for a single Cyrillic letter among Latin ones', () => {
    expect(looksCyrillic('Кнопка експорту падає')).toBe(true);
    expect(looksCyrillic('Export кнопка')).toBe(true);
  });

  it('is false for English text, digits, punctuation and an empty box', () => {
    expect(looksCyrillic('The export button crashes, 3.8 times!')).toBe(false);
    expect(looksCyrillic('')).toBe(false);
  });

  it('looks only at the first 50 characters', () => {
    expect(looksCyrillic('a'.repeat(cyrillicProbeLength) + 'ж')).toBe(false);
    expect(looksCyrillic('a'.repeat(cyrillicProbeLength - 1) + 'ж')).toBe(true);
  });
});

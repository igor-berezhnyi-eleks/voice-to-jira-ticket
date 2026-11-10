import { describe, expect, it } from 'vitest';
import { isNotProvided } from './notProvided';

describe('isNotProvided', () => {
  it('is true for exactly "Not provided"', () => {
    expect(isNotProvided('Not provided')).toBe(true);
  });

  it('is false for similar but different text', () => {
    expect(isNotProvided('Not provided.')).toBe(false);
    expect(isNotProvided('not provided')).toBe(false);
    expect(isNotProvided('Not provided yet')).toBe(false);
  });

  it('is false for real content', () => {
    expect(isNotProvided('Chrome on Windows')).toBe(false);
  });

  it('is true for blank text', () => {
    expect(isNotProvided('')).toBe(true);
    expect(isNotProvided('   \n')).toBe(true);
  });

  it('is true for an empty list', () => {
    expect(isNotProvided([])).toBe(true);
  });

  it('is true for a list with only blank items', () => {
    expect(isNotProvided(['', '  '])).toBe(true);
  });

  it('is false for a list with at least one real item', () => {
    expect(isNotProvided(['', 'Click Save'])).toBe(false);
  });
});

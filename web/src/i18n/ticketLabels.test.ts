import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ticketLabels } from './ticketLabels';
import { uk } from './uk';

describe('ticketLabels', () => {
  it('returns the dictionary group of the ticket language', () => {
    expect(ticketLabels('en')).toBe(en.ticketLabels);
    expect(ticketLabels('uk')).toBe(uk.ticketLabels);
    expect(ticketLabels('uk').notProvided).toBe('Не вказано');
  });

  it('falls back to English for a code with no dictionary', () => {
    expect(ticketLabels('pl')).toBe(en.ticketLabels);
    expect(ticketLabels('')).toBe(en.ticketLabels);
  });
});

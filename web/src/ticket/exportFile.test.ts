import { describe, expect, it } from 'vitest';
import { jsonFileName } from './exportFile';

describe('jsonFileName', () => {
  it('uses the lower-case type and local time as yyyyMMdd-HHmmss', () => {
    const date = new Date(2026, 10, 9, 7, 5, 3);
    expect(jsonFileName('Bug', date)).toBe('ticket-bug-20261109-070503.json');
    expect(jsonFileName('Feature', new Date(2026, 0, 31, 23, 59, 59))).toBe('ticket-feature-20260131-235959.json');
  });
});

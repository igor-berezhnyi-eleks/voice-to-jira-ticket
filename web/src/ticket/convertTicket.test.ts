import { describe, expect, it } from 'vitest';
import type { Ticket } from '../api';
import { convertTicket } from './convertTicket';

const bug: Ticket = {
  type: 'Bug',
  title: 'Export is empty',
  description: 'The CSV export has only a header row.',
  bug: {
    stepsToReproduce: ['Open the invoice list', 'Click Export CSV'],
    actualResult: 'Only the header row.',
    expectedResult: 'All twelve invoices.',
    environment: 'Chrome 126 on Windows 11',
  },
  feature: null,
  missingInformation: [
    { field: 'bug.environment', question: 'Which version?' },
    { field: 'feature.userNeed', question: 'Stray feature question' },
    { field: 'description', question: 'Say more?' },
    { field: 'title', question: 'A better title?' },
    { field: null, question: 'Is this a bug or a feature?' },
  ],
};

const feature: Ticket = {
  type: 'Feature',
  title: 'Footer note',
  description: 'A custom footer on invoices.',
  bug: null,
  feature: {
    userNeed: 'Customers want bank details on the invoice.',
    proposedBehavior: 'A free-text footer on the PDF.',
    acceptanceCriteria: ['The footer shows on every page', 'The footer is optional'],
  },
  missingInformation: [
    { field: 'feature.acceptanceCriteria', question: 'How do we know it is done?' },
    { field: 'bug.actualResult', question: 'Stray bug question' },
    { field: null, question: 'Is this a bug or a feature?' },
  ],
};

describe('convertTicket', () => {
  it('returns the ticket unchanged (a copy) when the type is the same', () => {
    const result = convertTicket(bug, 'Bug');

    expect(result).toEqual(bug);
    expect(result).not.toBe(bug);
  });

  it('converts a Bug to a Feature: expected result becomes the proposed behavior', () => {
    const result = convertTicket(bug, 'Feature');

    expect(result.type).toBe('Feature');
    expect(result.title).toBe(bug.title);
    expect(result.bug).toBeNull();
    expect(result.feature).toEqual({
      userNeed: 'Not provided',
      proposedBehavior: 'All twelve invoices.',
      acceptanceCriteria: [],
    });
  });

  it('keeps the bug-only details that have content in the description', () => {
    const { description } = convertTicket(bug, 'Feature');

    expect(description.startsWith(bug.description)).toBe(true);
    expect(description).toContain('Steps to reproduce:\n1. Open the invoice list\n2. Click Export CSV');
    expect(description).toContain('Actual result: Only the header row.');
    expect(description).toContain('Environment / platform: Chrome 126 on Windows 11');
    expect(description).not.toContain('Expected result');
  });

  it('adds nothing to the description for bug details that were not provided', () => {
    const sparse: Ticket = {
      ...bug,
      bug: { stepsToReproduce: [' '], actualResult: 'Not provided', expectedResult: 'Not provided', environment: '' },
    };

    const result = convertTicket(sparse, 'Feature');

    expect(result.description).toBe(bug.description);
    expect(result.feature?.proposedBehavior).toBe('Not provided');
  });

  it('converts a Feature to a Bug: proposed behavior becomes the expected result', () => {
    const result = convertTicket(feature, 'Bug');

    expect(result.type).toBe('Bug');
    expect(result.feature).toBeNull();
    expect(result.bug).toEqual({
      stepsToReproduce: [],
      actualResult: 'Not provided',
      expectedResult: 'A free-text footer on the PDF.',
      environment: 'Not provided',
    });
  });

  it('keeps the feature-only details that have content in the description', () => {
    const { description } = convertTicket(feature, 'Bug');

    expect(description.startsWith(feature.description)).toBe(true);
    expect(description).toContain('User or business need: Customers want bank details on the invoice.');
    expect(description).toContain('Acceptance criteria:\n- The footer shows on every page\n- The footer is optional');
    expect(description).not.toContain('Proposed behavior');
  });

  it('uses only the added lines when the description is itself not provided', () => {
    const result = convertTicket({ ...feature, description: 'Not provided' }, 'Bug');

    expect(result.description.startsWith('User or business need:')).toBe(true);
    expect(result.description).not.toContain('Not provided');
  });

  it('drops questions about fields of the other type and keeps the rest in order', () => {
    expect(convertTicket(bug, 'Feature').missingInformation).toEqual([
      { field: 'feature.userNeed', question: 'Stray feature question' },
      { field: 'description', question: 'Say more?' },
      { field: 'title', question: 'A better title?' },
      { field: null, question: 'Is this a bug or a feature?' },
    ]);
    // 'feature.acceptanceCriteria' goes; a question that already names a Bug field stays.
    expect(convertTicket(feature, 'Bug').missingInformation).toEqual([
      { field: 'bug.actualResult', question: 'Stray bug question' },
      { field: null, question: 'Is this a bug or a feature?' },
    ]);
  });

  it('does not change its input', () => {
    const before = JSON.stringify(bug);

    convertTicket(bug, 'Feature');

    expect(JSON.stringify(bug)).toBe(before);
  });

  it('keeps an exact contract shape: details for exactly the new type', () => {
    for (const [source, to] of [[bug, 'Feature'], [feature, 'Bug']] as const) {
      const result = convertTicket(source, to);
      expect(Object.keys(result).sort()).toEqual(['bug', 'description', 'feature', 'missingInformation', 'title', 'type']);
      expect(to === 'Bug' ? result.feature : result.bug).toBeNull();
      expect(to === 'Bug' ? result.bug : result.feature).not.toBeNull();
    }
  });
});

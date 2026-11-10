import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../api';
import { renderJiraWiki } from './jiraWiki';

const bug: Ticket = {
  type: 'Bug',
  title: 'Saving an invoice crashes the editor',
  description: 'Saving with an empty date closes the editor.',
  bug: {
    stepsToReproduce: ['Open an invoice', 'Clear the date', 'Click Save'],
    actualResult: 'The editor closes.',
    expectedResult: 'Not provided',
    environment: 'Chrome on Windows',
  },
  feature: null,
  missingInformation: [{ field: 'bug.expectedResult', question: 'What should happen instead?' }],
};

const feature: Ticket = {
  type: 'Feature',
  title: 'Export invoices as PDF',
  description: 'Accountants want a PDF export.',
  bug: null,
  feature: { userNeed: 'Send invoices by email.', proposedBehavior: 'An Export button.', acceptanceCriteria: [] },
  missingInformation: [],
};

describe('renderJiraWiki', () => {
  it('renders a Bug with headings and # steps', () => {
    expect(renderJiraWiki(bug)).toBe(
      [
        'h1. Saving an invoice crashes the editor',
        'Type: Bug',
        '',
        'h2. Description',
        'Saving with an empty date closes the editor.',
        '',
        'h2. Steps to reproduce',
        '# Open an invoice',
        '# Clear the date',
        '# Click Save',
        '',
        'h2. Actual result',
        'The editor closes.',
        '',
        'h2. Expected result',
        'Not provided',
        '',
        'h2. Environment / platform',
        'Chrome on Windows',
      ].join('\n'),
    );
  });

  it('renders a Feature with an empty list as "Not provided"', () => {
    expect(renderJiraWiki(feature)).toBe(
      [
        'h1. Export invoices as PDF',
        'Type: Feature',
        '',
        'h2. Description',
        'Accountants want a PDF export.',
        '',
        'h2. User or business need',
        'Send invoices by email.',
        '',
        'h2. Proposed behavior',
        'An Export button.',
        '',
        'h2. Acceptance criteria',
        'Not provided',
      ].join('\n'),
    );
  });

  it('renders acceptance criteria as * bullets, leaves user text unescaped and omits missing information', () => {
    const text = renderJiraWiki({
      ...bug,
      description: 'Error in {Foo} and *bold*',
      type: 'Feature',
      bug: null,
      feature: { userNeed: 'n', proposedBehavior: 'p', acceptanceCriteria: ['Downloads a PDF', 'Shows the number'] },
    });

    expect(text).toContain('h2. Acceptance criteria\n* Downloads a PDF\n* Shows the number');
    expect(text).toContain('Error in {Foo} and *bold*');
    expect(text).not.toContain('What should happen instead?');
  });
});

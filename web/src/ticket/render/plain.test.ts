import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../api';
import { renderPlain } from './plain';

const bug: Ticket = {
  type: 'Bug',
  title: 'Saving an invoice crashes the editor',
  description: 'Saving with an empty date closes the editor.\nIt happens every time.',
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
  feature: { userNeed: 'Send invoices by email.', proposedBehavior: 'Not provided', acceptanceCriteria: [] },
  missingInformation: [{ field: null, question: 'Which formats?' }],
};

describe('renderPlain', () => {
  it('renders a Bug with numbered steps and keeps "Not provided" and line breaks', () => {
    expect(renderPlain(bug)).toBe(
      [
        'Saving an invoice crashes the editor',
        'Type: Bug',
        '',
        'Description',
        'Saving with an empty date closes the editor.',
        'It happens every time.',
        '',
        'Steps to reproduce',
        '1. Open an invoice',
        '2. Clear the date',
        '3. Click Save',
        '',
        'Actual result',
        'The editor closes.',
        '',
        'Expected result',
        'Not provided',
        '',
        'Environment / platform',
        'Chrome on Windows',
      ].join('\n'),
    );
  });

  it('renders a Feature with an empty list as "Not provided"', () => {
    expect(renderPlain(feature)).toBe(
      [
        'Export invoices as PDF',
        'Type: Feature',
        '',
        'Description',
        'Accountants want a PDF export.',
        '',
        'User or business need',
        'Send invoices by email.',
        '',
        'Proposed behavior',
        'Not provided',
        '',
        'Acceptance criteria',
        'Not provided',
      ].join('\n'),
    );
  });

  it('renders acceptance criteria as bullets and leaves out missing information', () => {
    const text = renderPlain({
      ...feature,
      feature: { userNeed: 'n', proposedBehavior: 'p', acceptanceCriteria: ['Downloads a PDF', 'Shows the number'] },
    });

    expect(text).toContain('Acceptance criteria\n- Downloads a PDF\n- Shows the number');
    expect(text).not.toContain('Which formats?');
    expect(text.toLowerCase()).not.toContain('missing information');
  });
});

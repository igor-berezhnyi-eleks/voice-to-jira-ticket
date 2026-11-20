import { describe, expect, it } from 'vitest';
import type { Ticket } from '../api';
import { editedTicket } from './editedTicket';

const bug: Ticket = {
  type: 'Bug',
  language: 'en',
  title: 'Original title',
  description: 'Original description',
  bug: { stepsToReproduce: ['a'], actualResult: 'x', expectedResult: 'Not provided', environment: 'Not provided' },
  feature: null,
  missingInformation: [{ field: 'bug.expectedResult', question: 'What should happen?' }],
};

const feature: Ticket = {
  type: 'Feature',
  language: 'en',
  title: 'Export',
  description: 'Export invoices',
  bug: null,
  feature: { userNeed: 'need', proposedBehavior: 'button', acceptanceCriteria: [] },
  missingInformation: [],
};

describe('editedTicket', () => {
  it('builds a Bug from the edits, dropping blank rows and keeping only text', () => {
    const result = editedTicket(
      bug,
      {
        title: 'New title',
        description: 'New description',
        'bug.actualResult': 'It closes',
        'bug.expectedResult': 'It saves',
        'bug.environment': 'Chrome',
      },
      { 'bug.stepsToReproduce': [{ text: 'Open' }, { text: '' }, { text: '   ' }, { text: 'Save' }] },
    );

    expect(result).toEqual({
      type: 'Bug',
      language: 'en',
      title: 'New title',
      description: 'New description',
      bug: { stepsToReproduce: ['Open', 'Save'], actualResult: 'It closes', expectedResult: 'It saves', environment: 'Chrome' },
      feature: null,
      missingInformation: bug.missingInformation,
    });
  });

  it('keeps the language of the base ticket', () => {
    expect(editedTicket({ ...bug, language: 'uk' }, {}, {}).language).toBe('uk');
  });

  it('turns blank text into exactly "Not provided" and trims the rest', () => {
    const result = editedTicket(
      bug,
      { title: '  ', description: '  padded  ', 'bug.actualResult': '', 'bug.expectedResult': ' ', 'bug.environment': 'Not provided' },
      { 'bug.stepsToReproduce': [] },
    );

    expect(result.title).toBe('Not provided');
    expect(result.description).toBe('padded');
    expect(result.bug).toEqual({
      stepsToReproduce: [],
      actualResult: 'Not provided',
      expectedResult: 'Not provided',
      environment: 'Not provided',
    });
  });

  it('builds a Feature and leaves the other object null', () => {
    const result = editedTicket(
      feature,
      { title: 'Export', description: 'd', 'feature.userNeed': 'n', 'feature.proposedBehavior': 'p' },
      { 'feature.acceptanceCriteria': [{ text: 'Downloads a PDF' }] },
    );

    expect(result.bug).toBeNull();
    expect(result.feature).toEqual({ userNeed: 'n', proposedBehavior: 'p', acceptanceCriteria: ['Downloads a PDF'] });
  });

  it('does not change its inputs', () => {
    const lists = { 'bug.stepsToReproduce': [{ text: 'a' }, { text: '' }] };
    const copy = structuredClone(lists);
    editedTicket(bug, {}, lists);
    expect(lists).toEqual(copy);
    expect(bug.bug?.stepsToReproduce).toEqual(['a']);
  });
});

describe('editedTicket with a localised gap phrase', () => {
  it('turns the ticket language phrase back into the contract marker', () => {
    const ukBug: Ticket = { ...bug, language: 'uk' };
    const result = editedTicket(
      ukBug,
      { title: 'Заголовок', description: ' Не вказано ', 'bug.actualResult': 'Не вказано', 'bug.expectedResult': '', 'bug.environment': 'Не вказано.' },
      {},
    );

    expect(result.description).toBe('Not provided');
    expect(result.bug?.actualResult).toBe('Not provided');
    expect(result.bug?.expectedResult).toBe('Not provided');
    expect(result.bug?.environment).toBe('Не вказано.');
    expect(result.language).toBe('uk');
  });
});

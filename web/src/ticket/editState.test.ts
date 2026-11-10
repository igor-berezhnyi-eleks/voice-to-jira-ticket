import { describe, expect, it } from 'vitest';
import type { Ticket } from '../api';
import { editedTicket } from './editedTicket';
import type { FieldPath } from './fieldPaths';
import { hasEdits } from './editState';

const bug: Ticket = {
  type: 'Bug',
  title: 'Saving crashes',
  description: 'Saving closes the editor.',
  bug: {
    stepsToReproduce: ['Open', 'Save'],
    actualResult: 'Closes.',
    expectedResult: 'Not provided',
    environment: 'Chrome',
  },
  feature: null,
  missingInformation: [],
};

const texts: Partial<Record<FieldPath, string>> = {
  title: bug.title,
  description: bug.description,
  'bug.actualResult': 'Closes.',
  'bug.expectedResult': 'Not provided',
  'bug.environment': 'Chrome',
};
const lists: Partial<Record<FieldPath, { text: string }[]>> = { 'bug.stepsToReproduce': [{ text: 'Open' }, { text: 'Save' }] };

const original = editedTicket(bug, texts, lists);
const changed = (t = texts, l = lists) => hasEdits(original, editedTicket(bug, t, l));

describe('hasEdits', () => {
  it('is false for an untouched ticket', () => {
    expect(changed()).toBe(false);
  });

  it('is true after a text change', () => {
    expect(changed({ ...texts, title: 'Saving crashes badly' })).toBe(true);
  });

  it('is true after a list item is edited, added, removed or moved', () => {
    expect(changed(texts, { 'bug.stepsToReproduce': [{ text: 'Open' }, { text: 'Click Save' }] })).toBe(true);
    expect(changed(texts, { 'bug.stepsToReproduce': [{ text: 'Open' }, { text: 'Save' }, { text: 'Wait' }] })).toBe(true);
    expect(changed(texts, { 'bug.stepsToReproduce': [{ text: 'Open' }] })).toBe(true);
    expect(changed(texts, { 'bug.stepsToReproduce': [{ text: 'Save' }, { text: 'Open' }] })).toBe(true);
  });

  it('is false when the original text is typed back', () => {
    expect(changed({ ...texts, title: 'x' })).toBe(true);
    expect(changed({ ...texts, title: bug.title })).toBe(false);
  });

  it('ignores whitespace-only changes and blank list rows', () => {
    expect(changed({ ...texts, title: `  ${bug.title}  ` })).toBe(false);
    expect(changed(texts, { 'bug.stepsToReproduce': [{ text: 'Open' }, { text: '  ' }, { text: 'Save' }] })).toBe(false);
  });

  it('treats a blank "Not provided" field as unchanged', () => {
    expect(changed({ ...texts, 'bug.expectedResult': '   ' })).toBe(false);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse, Ticket } from '../api';
import { TicketPage } from './TicketPage';

const bugDetails = {
  stepsToReproduce: ['Open an invoice', 'Clear the date', 'Click Save'],
  actualResult: 'The editor closes.',
  expectedResult: 'Not provided',
  environment: 'Chrome on Windows',
};

const featureDetails = {
  userNeed: 'Accountants send invoices by email.',
  proposedBehavior: 'An Export button on each invoice.',
  acceptanceCriteria: ['The button downloads a PDF', 'The PDF has the invoice number'],
};

const bug: Ticket = {
  type: 'Bug',
  title: 'Saving an invoice crashes the editor',
  description: 'Saving an invoice with an empty date closes the editor.',
  bug: bugDetails,
  feature: null,
  missingInformation: [{ field: 'bug.expectedResult', question: 'What should happen instead?' }],
};

const feature: Ticket = {
  type: 'Feature',
  title: 'Export invoices as PDF',
  description: 'Accountants want a PDF export.',
  bug: null,
  feature: featureDetails,
  missingInformation: [],
};

function show(ticket: Ticket, onBack = () => undefined) {
  const response: GenerateTicketResponse = { ticket, provider: 'Fake', model: 'fake', durationMs: 12, usage: null };
  render(<TicketPage response={response} onBack={onBack} />);
}

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const itemsOf = (label: string) =>
  Array.from(screen.getByText(label).nextElementSibling?.querySelectorAll('li') ?? []).map((item) => item.textContent);

describe('TicketPage', () => {
  it('shows every field of a Bug', () => {
    show(bug);

    expect(screen.getByText('Bug', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: bug.title })).toBeTruthy();
    expect(valueOf('Description')).toBe(bug.description);
    expect(itemsOf('Steps to reproduce')).toEqual(bug.bug?.stepsToReproduce);
    expect(valueOf('Actual result')).toBe('The editor closes.');
    expect(valueOf('Expected result')).toBe('Not provided');
    expect(valueOf('Environment / platform')).toBe('Chrome on Windows');
    expect(screen.queryByText('Acceptance criteria')).toBeNull();
  });

  it('shows every field of a Feature', () => {
    show(feature);

    expect(screen.getByText('Feature', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: feature.title })).toBeTruthy();
    expect(valueOf('Description')).toBe(feature.description);
    expect(valueOf('User or business need')).toBe('Accountants send invoices by email.');
    expect(valueOf('Proposed behavior')).toBe('An Export button on each invoice.');
    expect(itemsOf('Acceptance criteria')).toEqual(feature.feature?.acceptanceCriteria);
    expect(screen.queryByText('Steps to reproduce')).toBeNull();
  });

  it('shows an empty list as Not provided instead of hiding it', () => {
    show({ ...bug, bug: { ...bugDetails, stepsToReproduce: [] } });

    expect(valueOf('Steps to reproduce')).toBe('Not provided');
  });

  it('shows empty acceptance criteria as Not provided', () => {
    show({ ...feature, feature: { ...featureDetails, acceptanceCriteria: [] } });

    expect(valueOf('Acceptance criteria')).toBe('Not provided');
  });

  it('lists the missing information, with and without a field', () => {
    show({
      ...bug,
      missingInformation: [
        { field: 'bug.expectedResult', question: 'What should happen instead?' },
        { field: null, question: 'Is this urgent?' },
      ],
    });

    const items = within('Missing information');
    expect(items).toEqual(['What should happen instead? (bug.expectedResult)', 'Is this urgent?']);
  });

  it('says so when no information is missing', () => {
    show(feature);

    expect(screen.getByText('Nothing is missing.')).toBeTruthy();
  });

  it('is read-only', () => {
    show(bug);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('input, textarea, select, [contenteditable]')).toBeNull();
  });

  it('shows the model and the generation time', () => {
    show(bug);

    expect(screen.getByText('Model fake, generated in 12 ms')).toBeTruthy();
  });

  it('calls onBack from the Back button', () => {
    const onBack = vi.fn();
    show(bug, onBack);

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});

function within(heading: string) {
  const section = screen.getByRole('heading', { name: heading }).parentElement;
  return Array.from(section?.querySelectorAll('li') ?? []).map((item) => item.textContent);
}

import { fireEvent, render, screen, within } from '@testing-library/react';
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

function responseOf(ticket: Ticket): GenerateTicketResponse {
  return { ticket, provider: 'Fake', model: 'fake', durationMs: 12, usage: null };
}

function show(ticket: Ticket, onBack = () => undefined) {
  return render(<TicketPage response={responseOf(ticket)} onBack={onBack} />);
}

const control = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
const type = (label: string, value: string) => fireEvent.change(control(label), { target: { value } });
const listGroup = (label: string) => screen.getByRole('group', { name: label });
const itemsOf = (label: string) =>
  within(listGroup(label))
    .queryAllByRole('textbox')
    .map((box) => (box as HTMLTextAreaElement).value);
const isFlagged = (label: string) => control(label).closest('.not-provided') !== null;
const isListFlagged = (label: string) => listGroup(label).closest('.not-provided') !== null;

describe('TicketPage editing', () => {
  it('shows every field of a Bug as an editable control', () => {
    show(bug);

    expect(screen.getByText('Bug', { selector: '.badge' })).toBeTruthy();
    expect(control('Title').value).toBe(bug.title);
    expect(control('Title').tagName).toBe('INPUT');
    expect(control('Description').value).toBe(bug.description);
    expect(control('Description').tagName).toBe('TEXTAREA');
    expect(itemsOf('Steps to reproduce')).toEqual(bugDetails.stepsToReproduce);
    expect(control('Actual result').value).toBe('The editor closes.');
    expect(control('Expected result').value).toBe('Not provided');
    expect(control('Environment / platform').value).toBe('Chrome on Windows');
    expect(screen.queryByLabelText('User or business need')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Acceptance criteria' })).toBeNull();
  });

  it('shows every field of a Feature as an editable control', () => {
    show(feature);

    expect(screen.getByText('Feature', { selector: '.badge' })).toBeTruthy();
    expect(control('Title').value).toBe(feature.title);
    expect(control('User or business need').value).toBe(featureDetails.userNeed);
    expect(control('Proposed behavior').value).toBe(featureDetails.proposedBehavior);
    expect(itemsOf('Acceptance criteria')).toEqual(featureDetails.acceptanceCriteria);
    expect(screen.queryByRole('group', { name: 'Steps to reproduce' })).toBeNull();
    expect(screen.queryByLabelText('Actual result')).toBeNull();
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

  it('edits text fields', () => {
    show(bug);

    type('Title', 'New title');
    type('Environment / platform', 'Firefox');

    expect(control('Title').value).toBe('New title');
    expect(control('Environment / platform').value).toBe('Firefox');
  });

  it('starts a fresh edit state when a new response arrives', () => {
    const { rerender } = show(bug);
    type('Title', 'Edited');

    rerender(<TicketPage response={responseOf(feature)} onBack={() => undefined} />);

    expect(control('Title').value).toBe(feature.title);
  });
});

describe('TicketPage not provided highlighting', () => {
  it('flags "Not provided" text with a visible cue and nothing else', () => {
    show(bug);

    expect(isFlagged('Expected result')).toBe(true);
    expect(screen.getAllByText('Needs content')).toHaveLength(1);
    expect(isFlagged('Environment / platform')).toBe(false);
    expect(isListFlagged('Steps to reproduce')).toBe(false);
  });

  it('removes the flag as soon as the text has real content', () => {
    show(bug);

    type('Expected result', 'A validation message is shown');

    expect(isFlagged('Expected result')).toBe(false);
    expect(screen.queryByText('Needs content')).toBeNull();
  });

  it('flags a field that is cleared', () => {
    show(bug);

    type('Environment / platform', '  ');

    expect(isFlagged('Environment / platform')).toBe(true);
  });

  it('flags an empty list and unflags it when an item gets text', () => {
    show({ ...bug, bug: { ...bugDetails, stepsToReproduce: [] } });
    expect(isListFlagged('Steps to reproduce')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add Steps to reproduce item' }));
    expect(isListFlagged('Steps to reproduce')).toBe(true);

    type('Steps to reproduce item 1', 'Open the invoice');
    expect(isListFlagged('Steps to reproduce')).toBe(false);
  });

  it('flags a list again when its last item is removed', () => {
    show({ ...feature, feature: { ...featureDetails, acceptanceCriteria: ['Only one'] } });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Acceptance criteria item 1' }));

    expect(itemsOf('Acceptance criteria')).toEqual([]);
    expect(isListFlagged('Acceptance criteria')).toBe(true);
  });
});

describe('TicketPage list editing', () => {
  it('adds an empty row at the end', () => {
    show(bug);

    fireEvent.click(screen.getByRole('button', { name: 'Add Steps to reproduce item' }));

    expect(itemsOf('Steps to reproduce')).toEqual([...bugDetails.stepsToReproduce, '']);
  });

  it('removes a row', () => {
    show(bug);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Steps to reproduce item 2' }));

    expect(itemsOf('Steps to reproduce')).toEqual(['Open an invoice', 'Click Save']);
  });

  it('edits a row', () => {
    show(bug);

    type('Steps to reproduce item 2', 'Empty the date');

    expect(itemsOf('Steps to reproduce')).toEqual(['Open an invoice', 'Empty the date', 'Click Save']);
  });

  it('moves rows up and down', () => {
    show(bug);

    fireEvent.click(screen.getByRole('button', { name: 'Move Steps to reproduce item 3 up' }));
    expect(itemsOf('Steps to reproduce')).toEqual(['Open an invoice', 'Click Save', 'Clear the date']);

    fireEvent.click(screen.getByRole('button', { name: 'Move Steps to reproduce item 1 down' }));
    expect(itemsOf('Steps to reproduce')).toEqual(['Click Save', 'Open an invoice', 'Clear the date']);
  });

  it('disables Move up on the first row and Move down on the last', () => {
    show(bug);

    const up = screen.getByRole('button', { name: 'Move Steps to reproduce item 1 up' }) as HTMLButtonElement;
    const down = screen.getByRole('button', { name: 'Move Steps to reproduce item 3 down' }) as HTMLButtonElement;
    const middle = screen.getByRole('button', { name: 'Move Steps to reproduce item 2 up' }) as HTMLButtonElement;

    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    expect(middle.disabled).toBe(false);
  });

  it('keeps each text with its row when a row above is removed', () => {
    show(bug);
    const secondRow = control('Steps to reproduce item 2');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Steps to reproduce item 1' }));

    expect(control('Steps to reproduce item 1')).toBe(secondRow);
  });

  it('edits the acceptance criteria of a Feature', () => {
    show(feature);

    fireEvent.click(screen.getByRole('button', { name: 'Add Acceptance criteria item' }));
    type('Acceptance criteria item 3', 'The file name has the date');

    expect(itemsOf('Acceptance criteria')).toEqual([...featureDetails.acceptanceCriteria, 'The file name has the date']);
  });
});

describe('TicketPage missing information', () => {
  const withQuestions: Ticket = {
    ...bug,
    missingInformation: [
      { field: 'bug.expectedResult', question: 'What should happen instead?' },
      { field: 'bug.stepsToReproduce', question: 'Which invoice?' },
      { field: null, question: 'Is this urgent?' },
      { field: 'feature.userNeed', question: 'Not a field of a Bug' },
    ],
  };

  it('lists every question as received', () => {
    show(withQuestions);

    const panel = screen.getByRole('heading', { name: 'Missing information' }).parentElement as HTMLElement;
    const items = Array.from(panel.querySelectorAll('li')).map((item) => item.textContent);

    expect(items).toEqual(['What should happen instead?', 'Which invoice?', 'Is this urgent?', 'Not a field of a Bug']);
  });

  it('says so when no information is missing', () => {
    show(feature);

    expect(screen.getByText('Nothing is missing.')).toBeTruthy();
  });

  it('moves focus to the field of a question', () => {
    show(withQuestions);

    fireEvent.click(screen.getByRole('button', { name: 'What should happen instead?' }));

    expect(document.activeElement).toBe(control('Expected result'));
  });

  it('moves focus to the first item of a list field', () => {
    show(withQuestions);

    fireEvent.click(screen.getByRole('button', { name: 'Which invoice?' }));

    expect(document.activeElement).toBe(control('Steps to reproduce item 1'));
  });

  it('moves focus to the Add button of an empty list', () => {
    show({
      ...withQuestions,
      bug: { ...bugDetails, stepsToReproduce: [] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Which invoice?' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Steps to reproduce item' }));
  });

  it('shows a question with no field, or a field of the other type, as plain text', () => {
    show(withQuestions);

    expect(screen.queryByRole('button', { name: 'Is this urgent?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not a field of a Bug' })).toBeNull();
    expect(screen.getByText('Is this urgent?')).toBeTruthy();
  });

  it('keeps a question after its field is filled', () => {
    show(withQuestions);

    type('Expected result', 'A validation message is shown');

    expect(screen.getByRole('button', { name: 'What should happen instead?' })).toBeTruthy();
  });
});

describe('TicketPage title hint', () => {
  it('warns once the title is longer than 120 characters, without limiting it', () => {
    show(bug);
    expect(screen.queryByText(/longer than 120 characters/)).toBeNull();

    type('Title', 'x'.repeat(121));

    expect(control('Title').value).toHaveLength(121);
    expect(screen.getByText(/longer than 120 characters/)).toBeTruthy();
  });
});

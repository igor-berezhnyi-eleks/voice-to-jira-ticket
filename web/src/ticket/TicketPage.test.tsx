import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse, Ticket } from '../api';
import { downloadText } from './exportFile';
import { renderJiraWiki } from './render/jiraWiki';
import { TicketPage } from './TicketPage';

vi.mock('./exportFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./exportFile')>()),
  downloadText: vi.fn(),
}));

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

const transcript = 'Saving an invoice with an empty date closes the editor.';

function show(ticket: Ticket, onBack = () => undefined, onRegenerated: (response: GenerateTicketResponse) => void = () => undefined) {
  return render(<TicketPage response={responseOf(ticket)} transcript={transcript} onBack={onBack} onRegenerated={onRegenerated} />);
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

    expect(control('Type').value).toBe('Bug');
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

    expect(control('Type').value).toBe('Feature');
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

    rerender(
      <TicketPage response={responseOf(feature)} transcript={transcript} onBack={() => undefined} onRegenerated={() => undefined} />,
    );

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

describe('TicketPage preview', () => {
  const preview = () => (screen.getByLabelText('Preview') as HTMLTextAreaElement).value;
  const choose = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));

  it('shows the plain text preview by default, without the missing-information questions', () => {
    show(bug);

    expect(preview()).toContain('Saving an invoice crashes the editor\nType: Bug');
    expect(preview()).toContain('Steps to reproduce\n1. Open an invoice\n2. Clear the date\n3. Click Save');
    expect(preview()).toContain('Expected result\nNot provided');
    expect(preview()).not.toContain('What should happen instead?');
    expect((screen.getByLabelText('Preview') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByRole('radio', { name: 'Plain' })).toHaveProperty('checked', true);
  });

  it('follows edits, and drops blank rows', () => {
    show(bug);

    type('Title', 'Edited title');
    type('Expected result', 'It saves');
    fireEvent.click(screen.getByRole('button', { name: 'Add Steps to reproduce item' }));

    expect(preview()).toContain('Edited title\nType: Bug');
    expect(preview()).toContain('Expected result\nIt saves');
    expect(preview()).toContain('3. Click Save');
    expect(preview()).not.toContain('4.');
  });

  it('switches to Jira wiki and shows a rendered view only in that mode', () => {
    show(bug);
    expect(screen.queryByRole('heading', { name: 'Saving an invoice crashes the editor' })).toBeNull();

    choose('Jira wiki');

    expect(preview()).toContain('h1. Saving an invoice crashes the editor');
    expect(preview()).toContain('# Open an invoice');
    expect(screen.getByRole('heading', { level: 3, name: 'Saving an invoice crashes the editor' })).toBeTruthy();
    expect(control('Title').value).toBe(bug.title);

    choose('Plain');

    expect(preview()).not.toContain('h1.');
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});

describe('TicketPage copy', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  function setClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  it('copies exactly the previewed text and confirms for about two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    show(bug);
    fireEvent.click(screen.getByRole('radio', { name: 'Jira wiki' }));
    const shown = (screen.getByLabelText('Preview') as HTMLTextAreaElement).value;

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(shown);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('says so when the clipboard rejects', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    show(bug);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(/Copy failed/)).toBeTruthy();
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('says so when there is no clipboard', async () => {
    show(bug);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(/Copy failed/)).toBeTruthy();
  });
});

describe('TicketPage export', () => {
  it('saves the edited ticket as JSON in contract shape', async () => {
    show(bug);
    type('Title', 'Edited title');
    fireEvent.click(screen.getByRole('button', { name: 'Add Steps to reproduce item' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save as JSON' }));

    await waitFor(() => expect(downloadText).toHaveBeenCalledOnce());
    const [fileName, text] = vi.mocked(downloadText).mock.calls[0];
    expect(fileName).toMatch(/^ticket-bug-\d{8}-\d{6}\.json$/);
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
    expect(JSON.parse(text)).toEqual({
      ...bug,
      title: 'Edited title',
    });
  });

  it('shows a disabled Jira button with an explanation when Jira is not configured', () => {
    show(bug);

    const button = screen.getByRole('button', { name: 'Connect to Jira board' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Jira is not configured');
  });

  it('enables the Jira button and hands over the edited ticket and its wiki text', () => {
    const onConnectJira = vi.fn();
    render(
      <TicketPage
        response={responseOf(bug)}
        transcript={transcript}
        onBack={() => undefined}
        onRegenerated={() => undefined}
        jiraEnabled
        onConnectJira={onConnectJira}
      />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited title' } });

    const button = screen.getByRole('button', { name: 'Connect to Jira board' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(onConnectJira).toHaveBeenCalledOnce();
    const [ticket, wiki] = onConnectJira.mock.calls[0];
    expect(ticket.title).toBe('Edited title');
    expect(wiki).toBe(renderJiraWiki(ticket));
  });
});

describe('TicketPage regenerate', () => {
  const freshTicket: Ticket = { ...bug, title: 'A freshly generated title' };
  const regenerateButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Regenerate' });

  function okResponse(ticket: Ticket): Response {
    return new Response(JSON.stringify(responseOf(ticket)), { status: 200 });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the transcript at once when nothing was edited', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse(freshTicket));
    vi.stubGlobal('fetch', fetchMock);
    const onRegenerated = vi.fn();
    show(bug, undefined, onRegenerated);

    fireEvent.click(regenerateButton());

    expect(screen.queryByText(/replaces your edits/)).toBeNull();
    await waitFor(() => expect(onRegenerated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ transcript });
    expect(onRegenerated.mock.calls[0][0].ticket.title).toBe('A freshly generated title');
  });

  it('does not count typing the original text back as an edit', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse(freshTicket));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    type('Title', 'Something else');
    type('Title', bug.title);

    fireEvent.click(regenerateButton());

    expect(screen.queryByText(/replaces your edits/)).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it('asks first when fields were edited, and Cancel sends nothing and keeps the edit', () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    type('Title', 'My edited title');

    fireEvent.click(regenerateButton());

    expect(screen.getByText('Regenerating replaces your edits with a new ticket. Continue?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/replaces your edits/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(control('Title').value).toBe('My edited title');
  });

  it('sends the request after Replace', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse(freshTicket));
    vi.stubGlobal('fetch', fetchMock);
    const onRegenerated = vi.fn();
    show(bug, undefined, onRegenerated);
    type('Title', 'My edited title');

    fireEvent.click(regenerateButton());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(onRegenerated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.queryByText(/replaces your edits/)).toBeNull();
  });

  it('disables Regenerate and shows progress while running, keeping the edits on screen', async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    type('Title', 'My edited title');
    fireEvent.click(regenerateButton());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    expect(regenerateButton().disabled).toBe(true);
    expect(screen.getByText('Generating…')).toBeTruthy();
    expect(control('Title').value).toBe('My edited title');
    fireEvent.click(regenerateButton());
    expect(fetchMock).toHaveBeenCalledOnce();

    respond(okResponse(freshTicket));
    await waitFor(() => expect(regenerateButton().disabled).toBe(false));
  });

  it('shows the error and keeps the edits when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));
    const onRegenerated = vi.fn();
    show(bug, undefined, onRegenerated);
    type('Title', 'My edited title');
    fireEvent.click(regenerateButton());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain('Could not reach the server');
    expect(onRegenerated).not.toHaveBeenCalled();
    expect(control('Title').value).toBe('My edited title');
    expect(regenerateButton().disabled).toBe(false);
  });

  it('offers Retry for a retryable error, and Retry asks again when there are edits', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    type('Title', 'My edited title');
    fireEvent.click(regenerateButton());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText(/replaces your edits/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('offers no Retry when the error says the transcript must change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ title: 'Refused', status: 422, code: 'llm_refused' }), { status: 422 })),
    );
    show(bug);

    fireEvent.click(regenerateButton());
    await screen.findByRole('alert');

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('aborts a running request when the page is left', () => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((_url, init) => {
        signal = init?.signal;
        return new Promise(() => undefined);
      }),
    );
    const { unmount } = show(bug);
    fireEvent.click(regenerateButton());

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

describe('TicketPage back', () => {
  it('goes back at once when nothing was edited', () => {
    const onBack = vi.fn();
    show(bug, onBack);

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.queryByText(/discards your edits/)).toBeNull();
  });

  it('asks first when edited; Cancel stays and keeps the edit', () => {
    const onBack = vi.fn();
    show(bug, onBack);
    type('Title', 'My edited title');

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(screen.getByText('Going back discards your edits to this ticket. Continue?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/discards your edits/)).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    expect(control('Title').value).toBe('My edited title');
  });

  it('goes back after Discard', () => {
    const onBack = vi.fn();
    show(bug, onBack);
    type('Title', 'My edited title');

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('TicketPage type picker', () => {
  const pickType = (value: 'Bug' | 'Feature') => fireEvent.change(control('Type'), { target: { value } });
  const notice = () => screen.queryByText(/in your browser/);
  const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call = 0) => JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
  const okFeature = () => new Response(JSON.stringify(responseOf(feature)), { status: 200 });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(downloadText).mockClear();
  });

  it('offers Bug and Feature with the ticket type selected, for every ticket', () => {
    show(feature);

    const select = control('Type') as unknown as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['Bug', 'Feature']);
    expect(select.value).toBe('Feature');
    expect(notice()).toBeNull();
  });

  it('converts at once without a request: the new fields show, the old ones go, title stays', () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    show(bug);

    pickType('Feature');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(control('Type').value).toBe('Feature');
    expect(control('Title').value).toBe(bug.title);
    expect(control('Proposed behavior').value).toBe('Not provided');
    expect(isFlagged('User or business need')).toBe(true);
    expect(isListFlagged('Acceptance criteria')).toBe(true);
    expect(screen.queryByRole('group', { name: 'Steps to reproduce' })).toBeNull();
    expect(screen.queryByLabelText('Actual result')).toBeNull();
    expect(control('Description').value).toContain('Steps to reproduce:\n1. Open an invoice');
    expect(control('Description').value).toContain('Environment / platform: Chrome on Windows');
    expect(notice()?.textContent).toBe('Converted from Bug in your browser. Regenerate as Feature for a better ticket.');
  });

  it('carries edits into the conversion and drops questions about the other type', () => {
    show(bug);
    expect(screen.getByText('What should happen instead?')).toBeTruthy();
    type('Expected result', 'The editor stays open.');

    pickType('Feature');

    expect(control('Proposed behavior').value).toBe('The editor stays open.');
    expect(screen.queryByText('What should happen instead?')).toBeNull();
    expect(screen.getByText('Nothing is missing.')).toBeTruthy();
  });

  it('restores the earlier view, edits included, when switching back, and the notice goes', () => {
    show(bug);
    type('Title', 'My bug title');
    pickType('Feature');
    type('User or business need', 'A need I typed as a feature');

    pickType('Bug');

    expect(control('Title').value).toBe('My bug title');
    expect(control('Expected result').value).toBe('Not provided');
    expect(itemsOf('Steps to reproduce')).toEqual(bugDetails.stepsToReproduce);
    expect(screen.getByText('What should happen instead?')).toBeTruthy();
    expect(notice()).toBeNull();

    pickType('Feature');

    expect(control('User or business need').value).toBe('A need I typed as a feature');
    expect(notice()).not.toBeNull();
  });

  it('does not ask before going back after a plain conversion, but asks when the other view had edits', () => {
    const onBack = vi.fn();
    show(bug, onBack);
    pickType('Feature');
    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    expect(onBack).toHaveBeenCalledOnce();

    onBack.mockClear();
    cleanup();
    show(bug, onBack);
    type('Title', 'Edited as a bug');
    pickType('Feature');
    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(screen.getByText('Going back discards your edits to this ticket. Continue?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('follows the selected type in the preview and in Save as JSON', () => {
    show(bug);
    pickType('Feature');

    expect((screen.getByLabelText('Preview', { selector: 'textarea' }) as HTMLTextAreaElement).value).toContain('Proposed behavior');
    fireEvent.click(screen.getByRole('button', { name: 'Save as JSON' }));

    const [fileName, text] = vi.mocked(downloadText).mock.calls[0];
    expect(fileName).toMatch(/^ticket-feature-\d{8}-\d{6}\.json$/);
    const saved = JSON.parse(text);
    expect(saved.type).toBe('Feature');
    expect(saved.bug).toBeNull();
    expect(saved.feature.proposedBehavior).toBe('Not provided');
  });

  it('Regenerate as <type> sends the transcript with the type, with no question when nothing was edited', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(okFeature()));
    vi.stubGlobal('fetch', fetchMock);
    const onRegenerated = vi.fn();
    show(bug, undefined, onRegenerated);
    pickType('Feature');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate as Feature' }));

    expect(screen.queryByText(/replaces your edits/)).toBeNull();
    await waitFor(() => expect(onRegenerated).toHaveBeenCalledOnce());
    expect(bodyOf(fetchMock)).toEqual({ transcript, type: 'Feature' });
    expect(onRegenerated.mock.calls[0][0].ticket.type).toBe('Feature');
  });

  it('Regenerate as <type> asks first when there are edits, and Replace sends the type', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(okFeature()));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    pickType('Feature');
    type('Proposed behavior', 'My own behaviour');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate as Feature' }));

    expect(screen.getByText('Regenerating replaces your edits with a new ticket. Continue?')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(bodyOf(fetchMock)).toEqual({ transcript, type: 'Feature' });
  });

  it('plain Regenerate still lets the model decide, even after a conversion', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(okFeature()));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    pickType('Feature');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(bodyOf(fetchMock)).toEqual({ transcript });
  });

  it('keeps the converted ticket on failure, and Retry asks for the same type again', async () => {
    const failure = () => new Response(JSON.stringify({ title: 'Down', status: 503, code: 'llm_unavailable' }), { status: 503 });
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(failure()));
    vi.stubGlobal('fetch', fetchMock);
    show(bug);
    pickType('Feature');
    type('Proposed behavior', 'Kept on failure');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate as Feature' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await screen.findByRole('alert');

    expect(control('Proposed behavior').value).toBe('Kept on failure');
    expect(control('Type').value).toBe('Feature');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1)).toEqual({ transcript, type: 'Feature' });
  });

  it('starts a fresh view when a new response arrives', () => {
    const { rerender } = show(bug);
    pickType('Feature');

    rerender(<TicketPage response={responseOf(feature)} transcript={transcript} onBack={() => undefined} onRegenerated={() => undefined} />);

    expect(control('Type').value).toBe('Feature');
    expect(control('Title').value).toBe(feature.title);
    expect(notice()).toBeNull();
  });
});

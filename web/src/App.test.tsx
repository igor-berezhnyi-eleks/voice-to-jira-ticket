import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse } from './api';
import { App } from './App';
import { renderJiraWiki } from './ticket/render/jiraWiki';
import { bodyOf, callsTo, issueTypes, jsonResponse, noFields, problem, projects, stubJiraFetch } from './jira/fakeJira';

const transcript = 'The invoice editor crashes when the date is empty.';
const bannerText = 'Fake generator active — tickets are not real';

const generatedTicket: GenerateTicketResponse['ticket'] = {
  type: 'Bug',
  language: 'en',
  title: 'The invoice editor crashes when the date is empty',
  description: transcript,
  bug: { stepsToReproduce: ['Open an invoice', 'Clear the date'], actualResult: 'It crashes', expectedResult: 'Not provided', environment: 'Not provided' },
  feature: null,
  missingInformation: [],
};

function ticketResponse(provider: string, ticket = generatedTicket): Response {
  const body: GenerateTicketResponse = {
    ticket,
    provider,
    model: provider === 'Fake' ? 'fake' : 'real-model',
    durationMs: 1,
    usage: null,
  };
  return new Response(JSON.stringify(body), { status: 200 });
}

function validationProblem(): Response {
  return new Response(
    JSON.stringify({ title: 'Invalid', status: 400, code: 'validation', errors: { Transcript: ['The transcript is too short.'] } }),
    { status: 400 },
  );
}

/**
 * Page 1 asks the Jira status when it shows. This answers it with Jira off and hands every other call to
 * `tickets`, which the test then inspects.
 */
function stubTicketFetch(tickets: ReturnType<typeof vi.fn<typeof fetch>>) {
  const jiraOff = () => new Response(JSON.stringify({ enabled: false, connected: false, displayName: null, defaultProjectKey: null }));
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) => (String(input) === '/api/jira/status' ? Promise.resolve(jiraOff()) : tickets(input, init))),
  );
  return tickets;
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Transcript' });
const generateButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Generate ticket' });
const type = (value: string) => fireEvent.change(textarea(), { target: { value } });
/** Page 3's Description; Page 2, kept mounted (hidden) behind it, has a Description field too. */
function jiraDescription(): HTMLTextAreaElement {
  const field = screen.getAllByLabelText<HTMLTextAreaElement>('Description').find((each) => each.closest('[hidden]') === null);
  if (!field) throw new Error('Page 3 Description not found');
  return field;
}

describe('Page 1', () => {
  it('disables Generate under 20 characters and enables it at 20', () => {
    render(<App />);
    expect(generateButton().disabled).toBe(true);

    type('x'.repeat(19));
    expect(generateButton().disabled).toBe(true);

    type('x'.repeat(20));
    expect(generateButton().disabled).toBe(false);
  });

  it('disables Generate while a request runs and sends only one request', async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve)));
    stubTicketFetch(fetchMock);
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    expect(generateButton().disabled).toBe(true);
    fireEvent.click(generateButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respond(ticketResponse('Fake'));
    await screen.findByRole('button', { name: 'Back to transcript' });
  });

  it('shows the error and keeps the transcript when the API rejects the request', async () => {
    stubTicketFetch(vi.fn<typeof fetch>().mockResolvedValue(validationProblem()));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The transcript is too short.');
    expect(textarea().value).toBe(transcript);
    expect(generateButton().disabled).toBe(false);
  });

  it('shows an error and keeps the transcript when the network fails', async () => {
    stubTicketFetch(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    await screen.findByRole('alert');
    expect(textarea().value).toBe(transcript);
  });

  it('removes the previous error as soon as a retry starts', async () => {
    let respond: (response: Response) => void = () => undefined;
    stubTicketFetch(
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(validationProblem())
        .mockImplementationOnce(() => new Promise((resolve) => (respond = resolve))),
    );
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('alert');
    fireEvent.click(generateButton());

    expect(screen.queryByRole('alert')).toBeNull();

    respond(ticketResponse('Fake'));
    await screen.findByRole('button', { name: 'Back to transcript' });
  });
});

describe('moving between the pages', () => {
  it('shows the ticket after Generate, and Back returns with the transcript intact', async () => {
    stubTicketFetch(vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Fake')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    expect(title.value).toBe('The invoice editor crashes when the date is empty');

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(textarea().value).toBe(transcript);
  });
});

describe('regenerating', () => {
  it('replaces the ticket from the same transcript, and Back still shows the transcript', async () => {
    let generated = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url) === '/api/jira/status') {
        return new Response(JSON.stringify({ enabled: false, connected: false, displayName: null, defaultProjectKey: null }));
      }
      generated++;
      if (generated === 1) return ticketResponse('Fake');
      return new Response(
        JSON.stringify({
          ...(await ticketResponse('Fake').json()),
          ticket: { ...(await ticketResponse('Fake').json()).ticket, title: 'A second title' },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    type(transcript);
    fireEvent.click(generateButton());
    await screen.findByLabelText('Title');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    await waitFor(() => expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('A second title'));
    const generateCalls = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/tickets');
    expect(JSON.parse(String(generateCalls[1][1]?.body))).toEqual({ transcript });

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    expect(textarea().value).toBe(transcript);
  });
});

describe('Jira page', () => {
  const status = (enabled: boolean, connected: boolean) =>
    jsonResponse({ enabled, connected, displayName: connected ? 'Ada L' : null, defaultProjectKey: 'SCRUM' });

  async function toTicketPage() {
    render(<App />);
    type(transcript);
    fireEvent.click(generateButton());
    await screen.findByLabelText('Title');
  }

  it('keeps the Jira button disabled when Jira is off', async () => {
    const fetchMock = stubJiraFetch({
      'POST /api/tickets': () => ticketResponse('Fake'),
      'GET /api/jira/status': () => status(false, false),
    });
    await toTicketPage();

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Connect to Jira board' });
    await waitFor(() => expect(callsTo(fetchMock, 'GET /api/jira/status')).toHaveLength(1));
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Jira is not configured');
  });

  it('opens Page 3 for a connected user, and Back returns to Page 2 with its edits unchanged', async () => {
    stubJiraFetch({
      'POST /api/tickets': () => ticketResponse('Fake'),
      'GET /api/jira/status': () => status(true, true),
      'GET /api/jira/projects': () => jsonResponse(projects),
      'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse(issueTypes),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(noFields),
    });
    await toTicketPage();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My edited title' } });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Connect to Jira board' });
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);

    await screen.findByText('Connected as Ada L');
    expect((await screen.findByLabelText<HTMLInputElement>('Summary')).value).toBe('My edited title');

    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My edited title');
    expect(screen.queryByText('Connected as Ada L')).toBeNull();
  });

  it('shows the Connect panel when not connected', async () => {
    stubJiraFetch({ 'POST /api/tickets': () => ticketResponse('Fake'), 'GET /api/jira/status': () => status(true, false) });
    await toTicketPage();
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Connect to Jira board' });
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);

    await screen.findByLabelText('API token');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Title')).toBeTruthy();
  });
});

describe('Page 1 Go to Jira (generates first, N3)', () => {
  const status = (enabled: boolean, connected: boolean) =>
    jsonResponse({ enabled, connected, displayName: connected ? 'Ada L' : null, defaultProjectKey: 'SCRUM' });
  const jiraButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Go to Jira' });
  const page3Routes = {
    'GET /api/jira/status': () => status(true, true),
    'GET /api/jira/projects': () => jsonResponse(projects),
    'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse(issueTypes),
    'GET /api/jira/projects/SCRUM/issue-types/10001/fields': () => jsonResponse(noFields),
    'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(noFields),
  };

  it('is disabled with the reason when Jira is not configured', async () => {
    const fetchMock = stubJiraFetch({ 'GET /api/jira/status': () => status(false, false) });
    render(<App />);
    type(transcript);

    await waitFor(() => expect(callsTo(fetchMock, 'GET /api/jira/status')).toHaveLength(1));
    expect(jiraButton().disabled).toBe(true);
    expect(jiraButton().title).toBe('Jira is not configured');
  });

  it('stays disabled when the status call fails', async () => {
    const fetchMock = stubJiraFetch({ 'GET /api/jira/status': () => problem(500, 'internal_error') });
    render(<App />);
    type(transcript);

    await waitFor(() => expect(callsTo(fetchMock, 'GET /api/jira/status')).toHaveLength(1));
    expect(jiraButton().disabled).toBe(true);
  });

  it('follows Generate: disabled under 20 characters and while Generate runs', async () => {
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => new Promise<Response>(() => undefined) });
    render(<App />);
    type('x'.repeat(19));
    await waitFor(() => expect(jiraButton().title).toBe(''));
    expect(jiraButton().disabled).toBe(true);

    type(transcript);
    expect(jiraButton().disabled).toBe(false);
    fireEvent.click(generateButton());
    expect(jiraButton().disabled).toBe(true);
  });

  it('generates once with the same request as Generate, then shows Page 3 filled from the ticket', async () => {
    const fetchMock = stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => ticketResponse('Claude') });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    expect(screen.getByText('Generating…')).toBeTruthy();
    await screen.findByText('Connected as Ada L');
    expect(callsTo(fetchMock, 'POST /api/tickets')).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, 'POST /api/tickets')[0])).toEqual({ transcript });
    expect(screen.queryByRole('heading', { name: 'Review ticket' })).toBeNull();
    expect((await screen.findByLabelText<HTMLInputElement>('Summary')).value).toBe(generatedTicket.title);
    expect(jiraDescription().value).toBe(renderJiraWiki(generatedTicket));
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>('Issue type').value).toBe('10002'));
  });

  it('sends Page 3 the text Page 2 would send for the untouched ticket, normalised the same way', async () => {
    const untidy = {
      ...generatedTicket,
      title: '  Crash on save  ',
      bug: { stepsToReproduce: ['Open it ', '  ', 'Save'], actualResult: ' It crashes ', expectedResult: '', environment: 'Not provided' },
    };
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => ticketResponse('Claude', untidy) });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));
    fireEvent.click(jiraButton());
    await screen.findByText('Connected as Ada L');
    const fromPage1 = { summary: screen.getByLabelText<HTMLInputElement>('Summary').value, description: jiraDescription().value };

    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect to Jira board' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Review ticket' })).toBeNull());

    expect(fromPage1).toEqual({ summary: 'Crash on save', description: jiraDescription().value });
    expect(fromPage1.description).toContain('# Open it\n# Save');
  });

  it('leaves the summary empty when the title is "Not provided"', async () => {
    const untitled = { ...generatedTicket, title: 'Not provided' };
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => ticketResponse('Claude', untitled) });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    expect((await screen.findByLabelText<HTMLInputElement>('Summary')).value).toBe('');
    expect(jiraDescription().value).toBe(renderJiraWiki(untitled));
  });

  it('Back to ticket shows Page 2 with the ticket unedited; an edit there reaches Page 3 as today', async () => {
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => ticketResponse('Claude') });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));
    fireEvent.click(jiraButton());
    await screen.findByLabelText('Summary');

    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));

    expect(screen.getByRole('heading', { name: 'Review ticket' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(generatedTicket.title);
    expect(screen.queryByRole('group', { name: 'Confirm' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My edited title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect to Jira board' }));
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Summary').value).toBe('My edited title'));
  });

  it('shows a generation error on Page 1 and keeps the text', async () => {
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => validationProblem() });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    expect((await screen.findByRole('alert')).textContent).toContain('The transcript is too short.');
    expect(textarea().value).toBe(transcript);
    expect(screen.queryByText('Connected as Ada L')).toBeNull();
  });

  it('shows the Connect panel after generating when not connected, and Cancel shows Page 2', async () => {
    const fetchMock = stubJiraFetch({ 'GET /api/jira/status': () => status(true, false), 'POST /api/tickets': () => ticketResponse('Claude') });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    await screen.findByLabelText('API token');
    expect(callsTo(fetchMock, 'POST /api/tickets')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Review ticket' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(generatedTicket.title);
  });

  it('shows Page 2 with the ticket when Jira turns out to be off after generating', async () => {
    let jiraOn = true;
    stubJiraFetch({
      'GET /api/jira/status': () => status(jiraOn, false),
      'POST /api/tickets': () => {
        jiraOn = false;
        return ticketResponse('Claude');
      },
    });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    await screen.findByRole('heading', { name: 'Review ticket' });
    expect(screen.queryByLabelText('API token')).toBeNull();
  });

  it('shows the Fake banner on Page 3 when the fake generator made the ticket', async () => {
    stubJiraFetch({ ...page3Routes, 'POST /api/tickets': () => ticketResponse('Fake') });
    render(<App />);
    type(transcript);
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    await screen.findByText('Connected as Ada L');
    expect(screen.getByText(bannerText)).toBeTruthy();
  });

  it('replaces an older generated ticket', async () => {
    let generated = 0;
    stubJiraFetch({
      ...page3Routes,
      'POST /api/tickets': () => ticketResponse('Claude', { ...generatedTicket, title: `Ticket ${++generated}` }),
    });
    render(<App />);
    type(transcript);
    fireEvent.click(generateButton());
    await screen.findByRole('heading', { name: 'Review ticket' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    await waitFor(() => expect(jiraButton().disabled).toBe(false));

    fireEvent.click(jiraButton());

    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Summary').value).toBe('Ticket 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Ticket 2');
  });
});

describe('fake generator banner', () => {
  it('is absent until a response names the provider', () => {
    render(<App />);
    expect(screen.queryByText(bannerText)).toBeNull();
  });

  it('shows on Page 2 and stays after Back when the provider is Fake', async () => {
    stubTicketFetch(vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Fake')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('button', { name: 'Back to transcript' });
    expect(screen.getByText(bannerText)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    expect(screen.getByText(bannerText)).toBeTruthy();
  });

  it('does not show for another provider', async () => {
    stubTicketFetch(vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Claude')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('button', { name: 'Back to transcript' });

    expect(screen.queryByText(bannerText)).toBeNull();
  });
});

describe('header steps', () => {
  const status = (enabled: boolean, connected: boolean) =>
    jsonResponse({ enabled, connected, displayName: connected ? 'Ada L' : null, defaultProjectKey: 'SCRUM' });
  const progress = () => screen.getByLabelText('Progress');
  const step = (name: string) => within(progress()).getByRole<HTMLButtonElement>('button', { name: new RegExp(name) });
  const stepIsButton = (name: string) => within(progress()).queryByRole('button', { name: new RegExp(name) }) !== null;
  /** The tooltip of a disabled step sits on its wrapper (a disabled button takes no pointer events). */
  const reasonOf = (name: string) => step(name).parentElement?.title;
  const question = () => screen.queryByRole('group', { name: 'Confirm' });
  const titleBox = () => screen.getByLabelText<HTMLInputElement>('Title');
  const jiraRoutes = {
    'GET /api/jira/status': () => status(true, true),
    'GET /api/jira/projects': () => jsonResponse(projects),
    'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse(issueTypes),
    'GET /api/jira/projects/SCRUM/issue-types/10001/fields': () => jsonResponse(noFields),
    'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(noFields),
  };

  async function toTicketPage() {
    render(<App />);
    type(transcript);
    fireEvent.click(generateButton());
    await screen.findByLabelText('Title');
  }

  async function toJiraFromTicket() {
    await toTicketPage();
    await waitFor(() => expect(step('Jira').disabled).toBe(false));
    fireEvent.click(step('Jira'));
    await screen.findByText('Connected as Ada L');
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create issue' }).disabled).toBe(false));
  }

  async function toJiraFromReport() {
    render(<App />);
    type(transcript);
    await waitFor(() => expect(step('Jira').disabled).toBe(false));
    fireEvent.click(step('Jira'));
    await screen.findByText('Connected as Ada L');
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create issue' }).disabled).toBe(false));
  }

  describe('on Page 1', () => {
    it('shows the other steps as buttons and the current one as not clickable', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(true, false) });
      render(<App />);

      await waitFor(() => expect(stepIsButton('Review')).toBe(true));
      expect(stepIsButton('Jira')).toBe(true);
      expect(stepIsButton('Report')).toBe(false);
      expect(within(progress()).getByText('Report').closest('[aria-current="step"]')).toBeTruthy();
    });

    it('Review is disabled exactly when Generate is, with the reason, and generates like it', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => ticketResponse('Fake') });
      render(<App />);
      await waitFor(() => expect(stepIsButton('Review')).toBe(true));
      type('x'.repeat(19));
      expect(step('Review').disabled).toBe(true);
      expect(reasonOf('Review')).toBe('The report needs at least 20 characters');

      type(transcript);
      expect(step('Review').disabled).toBe(false);
      expect(reasonOf('Review')).toBe('');
      fireEvent.click(step('Review'));

      expect(screen.getByText('Generating…')).toBeTruthy();
      expect(step('Review').disabled).toBe(true);
      expect(step('Jira').disabled).toBe(true);
      await screen.findByLabelText('Title');
    });

    it('Review shows a generation error where Generate shows it', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => validationProblem() });
      render(<App />);
      type(transcript);
      await waitFor(() => expect(stepIsButton('Review')).toBe(true));

      fireEvent.click(step('Review'));

      expect((await screen.findByRole('alert')).textContent).toContain('The transcript is too short.');
      expect(textarea().value).toBe(transcript);
    });

    it('Jira is disabled exactly when Go to Jira is, with the reason, and generates then opens Page 3 like it', async () => {
      stubJiraFetch({ ...jiraRoutes, 'GET /api/jira/status': () => status(false, false) });
      render(<App />);
      await waitFor(() => expect(stepIsButton('Jira')).toBe(true));
      type(transcript);
      await waitFor(() => expect(reasonOf('Jira')).toBe('Jira is not configured'));
      expect(step('Jira').disabled).toBe(true);
      cleanup();

      const fetchMock = stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Claude') });
      render(<App />);
      await waitFor(() => expect(reasonOf('Jira')).toBe('The report needs at least 20 characters'));
      expect(step('Jira').disabled).toBe(true);
      type(transcript);
      expect(step('Jira').disabled).toBe(false);

      fireEvent.click(step('Jira'));

      expect(screen.getByText('Generating…')).toBeTruthy();
      await screen.findByText('Connected as Ada L');
      expect(callsTo(fetchMock, 'POST /api/tickets')).toHaveLength(1);
      expect(jiraDescription().value).toBe(renderJiraWiki(generatedTicket));
    });
  });

  describe('on Page 2', () => {
    it('Report goes back at once when there are no edits', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();

      fireEvent.click(step('Report'));

      expect(textarea().value).toBe(transcript);
    });

    it('Report asks like Back when there are edits; Cancel keeps them, Discard goes back', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });

      fireEvent.click(step('Report'));
      expect(question()?.textContent).toContain('Going back discards your edits to this ticket. Continue?');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(titleBox().value).toBe('My edited title');

      fireEvent.click(step('Report'));
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(textarea().value).toBe(transcript);
    });

    it('Report asks about edits in a view parked by switching type', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });
      fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Feature' } });

      fireEvent.click(step('Report'));

      expect(question()).toBeTruthy();
    });

    it('Jira is disabled with the reason when Jira is off', async () => {
      stubJiraFetch({ 'GET /api/jira/status': () => status(false, false), 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();

      expect(step('Jira').disabled).toBe(true);
      expect(reasonOf('Jira')).toBe('Jira is not configured');
    });

    it('Jira carries the edits to Page 3 without a question, and Page 2 keeps them', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });
      await waitFor(() => expect(step('Jira').disabled).toBe(false));

      fireEvent.click(step('Jira'));

      expect((await screen.findByLabelText<HTMLInputElement>('Summary')).value).toBe('My edited title');
      expect(question()).toBeNull();
    });

    it('disables the steps while Regenerate runs', async () => {
      let generated = 0;
      stubJiraFetch({
        ...jiraRoutes,
        'POST /api/tickets': () => (++generated === 1 ? ticketResponse('Fake') : new Promise<Response>(() => undefined)),
      });
      await toTicketPage();
      await waitFor(() => expect(step('Jira').disabled).toBe(false));

      fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

      await waitFor(() => expect(step('Report').disabled).toBe(true));
      expect(step('Jira').disabled).toBe(true);
      expect(reasonOf('Report')).toBe('Wait until the current request has finished');
    });
  });

  describe('on Page 3 opened from Page 2', () => {
    it('Review returns to Page 2 with its edits, at once when Page 3 has no changes', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });
      await waitFor(() => expect(step('Jira').disabled).toBe(false));
      fireEvent.click(step('Jira'));
      await screen.findByText('Connected as Ada L');

      fireEvent.click(step('Review'));

      expect(question()).toBeNull();
      expect(titleBox().value).toBe('My edited title');
    });

    it('Review asks when Page 3 has changes; Cancel stays, Discard shows Page 2', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toJiraFromTicket();
      fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Changed summary' } });

      fireEvent.click(step('Review'));
      expect(question()?.textContent).toContain('Leaving this page discards what you changed here. Continue?');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByLabelText<HTMLInputElement>('Summary').value).toBe('Changed summary');

      fireEvent.click(step('Review'));
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(titleBox()).toBeTruthy();
      expect(screen.queryByText('Connected as Ada L')).toBeNull();
    });

    it('Report goes to Page 1 at once when neither page has changes', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toJiraFromTicket();

      fireEvent.click(step('Report'));

      expect(question()).toBeNull();
      expect(textarea().value).toBe(transcript);
    });

    it('Report asks about the Page 2 edits, then shows Page 1 with the text unchanged', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toTicketPage();
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });
      await waitFor(() => expect(step('Jira').disabled).toBe(false));
      fireEvent.click(step('Jira'));
      await screen.findByText('Connected as Ada L');

      fireEvent.click(step('Report'));
      expect(question()?.textContent).toContain('Going back to the report discards your edits to the ticket. Continue?');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Connected as Ada L')).toBeTruthy();

      fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Changed summary' } });
      fireEvent.click(step('Report'));
      expect(question()?.textContent).toContain('what you changed here and your edits to the ticket');
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(textarea().value).toBe(transcript);
    });

    it('Back to ticket asks under the same rule', async () => {
      stubJiraFetch({ ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Fake') });
      await toJiraFromTicket();
      // Page 2 (hidden) has a Description too; a role query skips hidden elements.
      fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Other text' } });

      fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));

      expect(question()).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(titleBox()).toBeTruthy();
    });
  });

  describe('on Page 3 opened from Page 1 (generated first)', () => {
    const routes = { ...jiraRoutes, 'POST /api/tickets': () => ticketResponse('Claude') };

    it('Review shows Page 2 with the generated ticket, at once when Page 3 has no changes', async () => {
      stubJiraFetch(routes);
      await toJiraFromReport();

      fireEvent.click(step('Review'));

      expect(question()).toBeNull();
      expect(titleBox().value).toBe(generatedTicket.title);
    });

    it('Review asks when Page 3 has changes; Cancel stays, Discard shows Page 2', async () => {
      stubJiraFetch(routes);
      await toJiraFromReport();
      fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'A summary' } });

      fireEvent.click(step('Review'));
      expect(question()?.textContent).toContain('Leaving this page discards what you changed here. Continue?');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByLabelText<HTMLInputElement>('Summary').value).toBe('A summary');

      fireEvent.click(step('Review'));
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(titleBox().value).toBe(generatedTicket.title);
    });

    it('Report goes to Page 1 at once without changes, and asks when Page 3 has changes', async () => {
      stubJiraFetch(routes);
      await toJiraFromReport();
      fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'A summary' } });

      fireEvent.click(step('Report'));
      expect(question()?.textContent).toContain('Leaving this page discards what you changed here. Continue?');
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

      expect(textarea().value).toBe(transcript);
    });

    it('Report asks about Page 2 edits made after Back to ticket', async () => {
      stubJiraFetch(routes);
      await toJiraFromReport();
      fireEvent.click(step('Review'));
      fireEvent.change(titleBox(), { target: { value: 'My edited title' } });
      fireEvent.click(screen.getByRole('button', { name: 'Connect to Jira board' }));
      await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Summary').value).toBe('My edited title'));

      fireEvent.click(step('Report'));

      expect(question()?.textContent).toContain('discards your edits to the ticket');
    });
  });
});

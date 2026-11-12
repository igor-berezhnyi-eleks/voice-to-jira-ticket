import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateInJiraPage } from './CreateInJiraPage';
import { bodyOf, callsTo, issueTypes, jsonResponse, noFields, problem, projects, stubJiraFetch } from './fakeJira';
import type { JiraStatus } from './jiraApi';

const connected: JiraStatus = { enabled: true, connected: true, displayName: 'Ada L', defaultProjectKey: 'SCRUM' };

function show(overrides: Partial<{ ticketType: 'Bug' | 'Feature'; status: JiraStatus; onBack: () => void }> = {}) {
  return render(
    <CreateInJiraPage
      summary="Export crashes"
      description="h3. Description\nIt crashes."
      ticketType={overrides.ticketType ?? 'Bug'}
      status={overrides.status ?? connected}
      onBack={overrides.onBack ?? (() => undefined)}
    />,
  );
}

const baseRoutes = () => ({
  'GET /api/jira/projects': () => jsonResponse(projects),
  'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse(issueTypes),
  'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(noFields),
  'GET /api/jira/projects/SCRUM/issue-types/10001/fields': () => jsonResponse(noFields),
});

const createButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Create issue' });
const typeSelect = () => screen.getByLabelText<HTMLSelectElement>('Issue type');
const waitReady = async () => waitFor(() => expect(createButton().disabled).toBe(false));

describe('CreateInJiraPage loading', () => {
  it('shows loading states, then the default project, the suggested type and the prefilled text', async () => {
    stubJiraFetch(baseRoutes());
    show();

    expect(screen.getByText('Loading projects…')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('SCRUM'));
    await waitFor(() => expect(typeSelect().value).toBe('10002'));
    expect((screen.getByLabelText('Summary') as HTMLInputElement).value).toBe('Export crashes');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toContain('It crashes.');
    expect(screen.getByText('Connected as Ada L')).toBeTruthy();
    await waitReady();
  });

  it('preselects the Feature suggestion for a Feature ticket', async () => {
    stubJiraFetch(baseRoutes());
    show({ ticketType: 'Feature' });
    await waitFor(() => expect(typeSelect().value).toBe('10001'));
  });

  it('chooses no project when the default is not in the list', async () => {
    stubJiraFetch(baseRoutes());
    show({ status: { ...connected, defaultProjectKey: 'NOPE' } });
    await screen.findByLabelText('Project');
    expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('');
    expect(createButton().disabled).toBe(true);
  });

  it('says so when a project has no issue types, and keeps Create disabled', async () => {
    stubJiraFetch({ ...baseRoutes(), 'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse([]) });
    show();
    await screen.findByText('This project has no issue types you can create here.');
    expect(createButton().disabled).toBe(true);
  });

  it('shows a load error with Try again that reloads', async () => {
    let fail = true;
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects': () => (fail ? problem(502, 'jira_unavailable') : jsonResponse(projects)),
    });
    show();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not reach Jira.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByLabelText('Project');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('CreateInJiraPage parent', () => {
  const withParents = {
    ...baseRoutes(),
    'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse({ fields: [], parentTypeIds: ['10000'] }),
  };

  it('hides the parent search when no type can be a parent', async () => {
    stubJiraFetch(baseRoutes());
    show();
    await waitReady();
    expect(screen.queryByLabelText('Search for a parent')).toBeNull();
  });

  it('searches only the parent types in the project and sends the picked parent', async () => {
    const fetchMock = stubJiraFetch({
      ...withParents,
      'POST /api/jira/issues/search': () => jsonResponse([{ key: 'SCRUM-12', summary: 'Reports epic', issueType: 'Epic', status: 'To Do' }]),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-13', url: 'https://x.atlassian.net/browse/SCRUM-13', warnings: [] }),
    });
    show();
    await waitReady();

    fireEvent.change(screen.getByLabelText('Search for a parent'), { target: { value: 'rep' } });
    fireEvent.click(await screen.findByRole('button', { name: /SCRUM-12 Reports epic/ }));

    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues/search')[0])).toEqual({
      projectKey: 'SCRUM',
      issueTypeIds: ['10000'],
      query: 'rep',
    });
    expect(screen.getByRole('button', { name: 'No parent' })).toBeTruthy();

    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-13' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).parentKey).toBe('SCRUM-12');
  });

  it('drops the parent when the issue type changes', async () => {
    stubJiraFetch({
      ...withParents,
      'POST /api/jira/issues/search': () => jsonResponse([{ key: 'SCRUM-12', summary: 'Reports epic', issueType: 'Epic', status: 'To Do' }]),
    });
    show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Search for a parent'), { target: { value: 'rep' } });
    fireEvent.click(await screen.findByRole('button', { name: /SCRUM-12/ }));

    fireEvent.change(typeSelect(), { target: { value: '10001' } });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'No parent' })).toBeNull());
    expect(screen.queryByText(/SCRUM-12/)).toBeNull();
  });
});

describe('CreateInJiraPage fields', () => {
  it('blocks Create and names a required field without a default', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () =>
        jsonResponse({
          fields: [{ fieldId: 'customfield_1', name: 'Severity', required: true, hasDefaultValue: false, kind: 'option', allowedValues: [] }],
          parentTypeIds: [],
        }),
    });
    show();
    const notice = await screen.findByText(/This issue type needs more fields \(coming in J5\)/);
    expect(notice.textContent).toContain('Severity');
    expect(createButton().disabled).toBe(true);
  });

  it('does not block on a required field that has a default, or on an optional one', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () =>
        jsonResponse({
          fields: [
            { fieldId: 'priority', name: 'Priority', required: true, hasDefaultValue: true, kind: 'option', allowedValues: [] },
            { fieldId: 'labels', name: 'Labels', required: false, hasDefaultValue: false, kind: 'labels', allowedValues: null },
          ],
          parentTypeIds: [],
        }),
    });
    show();
    await waitReady();
  });
});

describe('CreateInJiraPage editing', () => {
  it('sends the edited summary and description, and Reset to preview restores them', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-1', url: 'u', warnings: [] }),
    });
    show();
    await waitReady();

    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Edited summary' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Edited text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to preview' }));
    expect((screen.getByLabelText('Summary') as HTMLInputElement).value).toBe('Export crashes');
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: '  Edited summary ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Edited text' } });

    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-1' });

    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0])).toEqual({
      projectKey: 'SCRUM',
      issueTypeId: '10002',
      summary: 'Edited summary',
      description: 'Edited text',
      parentKey: null,
      fields: {},
      links: [],
    });
  });

  it('disables Create for an empty summary', async () => {
    stubJiraFetch(baseRoutes());
    show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: '   ' } });
    expect(createButton().disabled).toBe(true);
  });
});

describe('CreateInJiraPage create', () => {
  it('disables Create while running and sends one request', async () => {
    let respond: (r: Response) => void = () => undefined;
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () => new Promise<Response>((resolve) => (respond = resolve)),
    });
    show();
    await waitReady();

    fireEvent.click(createButton());
    expect(createButton().disabled).toBe(true);
    fireEvent.click(createButton());
    expect(callsTo(fetchMock, 'POST /api/jira/issues')).toHaveLength(1);

    respond(jsonResponse({ key: 'SCRUM-2', url: 'u', warnings: [] }));
    await screen.findByRole('link', { name: 'SCRUM-2' });
  });

  it('shows the key as a safe link, every warning, and Create another', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () =>
        jsonResponse({
          key: 'SCRUM-3',
          url: 'https://x.atlassian.net/browse/SCRUM-3',
          warnings: [
            { code: 'jira_link_failed', issueKey: 'SCRUM-9' },
            { code: 'jira_link_failed', issueKey: 'SCRUM-10' },
          ],
        }),
    });
    show();
    await waitReady();

    fireEvent.click(createButton());

    const link = await screen.findByRole('link', { name: 'SCRUM-3' });
    expect(link.getAttribute('href')).toBe('https://x.atlassian.net/browse/SCRUM-3');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/link to SCRUM-9 failed/)).toBeTruthy();
    expect(screen.getByText(/link to SCRUM-10 failed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create issue' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create another' }));
    expect(createButton().disabled).toBe(false);
    expect((screen.getByLabelText('Summary') as HTMLInputElement).value).toBe('Export crashes');
  });

  it('shows Jira messages next to summary and description and the rest at the top (jira_rejected)', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () =>
        problem(422, 'jira_rejected', {
          errors: { summary: 'Summary is too long', description: 'Bad markup', customfield_5: 'Severity is required' },
          errorMessages: ['Something general'],
        }),
    });
    show();
    await waitReady();

    fireEvent.click(createButton());

    await screen.findByText('Summary is too long');
    expect(screen.getByText('Bad markup')).toBeTruthy();
    expect(screen.getByText('Something general')).toBeTruthy();
    expect(screen.getByText('customfield_5: Severity is required')).toBeTruthy();
    expect(createButton().disabled).toBe(false);
  });

  it('says the issue may exist after a create timeout', async () => {
    stubJiraFetch({ ...baseRoutes(), 'POST /api/jira/issues': () => problem(504, 'jira_timeout') });
    show();
    await waitReady();
    fireEvent.click(createButton());
    await screen.findByText('The issue may have been created. Check Jira before trying again.');
  });

  it.each([
    ['jira_forbidden', 403, 'Your Jira account cannot do this in this project.'],
    ['jira_not_found', 404, 'Jira could not find that project or issue, or your account cannot see it.'],
    ['jira_rate_limited', 503, 'Jira is busy. Try again in a moment.'],
    ['jira_unavailable', 502, 'Could not reach Jira.'],
  ])('maps %s to plain text', async (code, status, message) => {
    stubJiraFetch({ ...baseRoutes(), 'POST /api/jira/issues': () => problem(status, code) });
    show();
    await waitReady();
    fireEvent.click(createButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
  });
});

describe('CreateInJiraPage session', () => {
  it('shows the Connect panel when not connected, and Cancel goes back', () => {
    stubJiraFetch({});
    const onBack = vi.fn();
    show({ status: { ...connected, connected: false }, onBack });
    expect(screen.getByLabelText('API token')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('opens the form after connecting', async () => {
    stubJiraFetch({ ...baseRoutes(), 'POST /api/jira/session': () => jsonResponse({ displayName: 'Bo' }) });
    show({ status: { ...connected, connected: false, displayName: null } });
    fireEvent.change(screen.getByLabelText('Atlassian email'), { target: { value: 'b@example.com' } });
    fireEvent.change(screen.getByLabelText('API token'), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByText('Connected as Bo');
  });

  it('keeps the Page 3 values when the session ends on create, and resumes after reconnecting', async () => {
    let expired = true;
    stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () =>
        expired ? problem(401, 'jira_auth_required') : jsonResponse({ key: 'SCRUM-4', url: 'u', warnings: [] }),
      'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }),
    });
    show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'My edit' } });

    fireEvent.click(createButton());
    await screen.findByLabelText('API token');
    expect(screen.getByText(/session has ended/)).toBeTruthy();

    expired = false;
    fireEvent.change(screen.getByLabelText('Atlassian email'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText('API token'), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect((screen.getByLabelText('Summary') as HTMLInputElement).value).toBe('My edit'));
    await waitReady();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the Connect panel when loading projects finds the session gone', async () => {
    stubJiraFetch({ ...baseRoutes(), 'GET /api/jira/projects': () => problem(401, 'jira_auth_required') });
    show();
    await screen.findByLabelText('API token');
  });

  it('Disconnect calls DELETE /session and shows the Connect panel', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'DELETE /api/jira/session': () => new Response(null, { status: 204 }),
    });
    show();
    await waitReady();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await screen.findByLabelText('API token');
    expect(callsTo(fetchMock, 'DELETE /api/jira/session')).toHaveLength(1);
  });

  it('Back calls onBack', async () => {
    stubJiraFetch(baseRoutes());
    const onBack = vi.fn();
    show({ onBack });
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

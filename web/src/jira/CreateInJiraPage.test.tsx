import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const severity = {
  fieldId: 'customfield_1',
  name: 'Severity',
  required: true,
  hasDefaultValue: false,
  kind: 'option',
  allowedValues: [
    { id: '7', name: 'Major' },
    { id: '8', name: 'Minor' },
  ],
} as const;
const severityFields = { fields: [severity], parentTypeIds: [] };

const priority = {
  fieldId: 'priority',
  name: 'Priority',
  required: false,
  hasDefaultValue: true,
  kind: 'option',
  allowedValues: [
    { id: '1', name: 'High' },
    { id: '3', name: 'Medium' },
  ],
} as const;
const labelsField = { fieldId: 'labels', name: 'Labels', required: false, hasDefaultValue: false, kind: 'labels', allowedValues: null } as const;
const dueDate = { fieldId: 'duedate', name: 'Due date', required: false, hasDefaultValue: false, kind: 'date', allowedValues: null } as const;

beforeEach(() => localStorage.clear());

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
  it('blocks Create, with the reason, until a required field without a default is filled', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(severityFields),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-5', url: 'u', warnings: [] }),
    });
    show();
    const select = await screen.findByLabelText<HTMLSelectElement>('Severity (required)');
    expect(createButton().disabled).toBe(true);
    expect(screen.getByText('Fill in the required fields: Severity.')).toBeTruthy();

    fireEvent.change(select, { target: { value: '7' } });

    expect(createButton().disabled).toBe(false);
    expect(screen.queryByText(/Fill in the required fields/)).toBeNull();
    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-5' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).fields).toEqual({ customfield_1: { kind: 'option', id: '7' } });
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

const fieldsRoute = (fields: unknown[], parentTypeIds: string[] = []) => () => jsonResponse({ fields, parentTypeIds });

describe('CreateInJiraPage required and optional fields', () => {
  it('names a required field it cannot fill, blocks Create and shows no control for it', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([
        { fieldId: 'customfield_9', name: 'Approver', required: true, hasDefaultValue: false, kind: 'unsupported', allowedValues: null },
      ]),
    });
    show();
    const notice = await screen.findByText(/This issue type requires .Approver., which this app can.t fill\./);
    expect(notice.textContent).toContain('Pick another issue type or create the issue in Jira.');
    expect(createButton().disabled).toBe(true);
    expect(screen.queryByLabelText(/Approver/)).toBeNull();
  });

  it('does not offer optional unsupported fields', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([
        { fieldId: 'customfield_9', name: 'Approver', required: false, hasDefaultValue: false, kind: 'unsupported', allowedValues: null },
      ]),
    });
    show();
    await waitReady();
    expect(screen.queryByLabelText('Add field')).toBeNull();
    expect(screen.queryByText(/Approver/)).toBeNull();
  });

  it('shows the right control for each required kind and sends typed values', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([
        { fieldId: 'summaryish', name: 'T', required: true, hasDefaultValue: false, kind: 'text', allowedValues: null },
        { fieldId: 'environment', name: 'Env', required: true, hasDefaultValue: false, kind: 'textarea', allowedValues: null },
        { fieldId: 'customfield_2', name: 'Points', required: true, hasDefaultValue: false, kind: 'number', allowedValues: null },
        { fieldId: 'customfield_3', name: 'Start', required: true, hasDefaultValue: false, kind: 'date', allowedValues: null },
        severity,
        {
          fieldId: 'components',
          name: 'Components',
          required: true,
          hasDefaultValue: false,
          kind: 'options',
          allowedValues: [
            { id: 'a', name: 'Api' },
            { id: 'b', name: 'Web' },
          ],
        },
        { ...labelsField, required: true },
      ]),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-6', url: 'u', warnings: [] }),
    });
    show();
    await screen.findByLabelText('T (required)');
    expect(createButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('T (required)'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Env (required)'), { target: { value: 'prod' } });
    fireEvent.change(screen.getByLabelText('Points (required)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Start (required)'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Severity (required)'), { target: { value: '8' } });
    const components = screen.getByLabelText<HTMLSelectElement>('Components (required)');
    components.options[1].selected = true;
    fireEvent.change(components);
    expect(createButton().disabled).toBe(true);
    expect(screen.getByText('Fill in the required fields: Labels.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Labels (required)'), { target: { value: 'voice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    expect(createButton().disabled).toBe(false);
    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-6' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).fields).toEqual({
      summaryish: { kind: 'text', value: 'x' },
      environment: { kind: 'textarea', value: 'prod' },
      customfield_2: { kind: 'number', value: 3 },
      customfield_3: { kind: 'date', value: '2026-11-12' },
      customfield_1: { kind: 'option', id: '8' },
      components: { kind: 'options', ids: ['b'] },
      labels: { kind: 'labels', values: ['voice'] },
    });
  });

  it('offers optional fields (and required ones with a default) under Add field, and an added field can be removed', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([priority, labelsField, dueDate, severity]),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-7', url: 'u', warnings: [] }),
    });
    show();
    await screen.findByLabelText('Severity (required)');
    fireEvent.change(screen.getByLabelText('Severity (required)'), { target: { value: '7' } });

    const add = screen.getByLabelText<HTMLSelectElement>('Add field');
    expect(Array.from(add.options).map((o) => o.text)).toEqual(['Choose a field…', 'Priority', 'Labels', 'Due date']);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add' }).disabled).toBe(true);

    fireEvent.change(add, { target: { value: 'priority' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '1' } });
    expect(Array.from(screen.getByLabelText<HTMLSelectElement>('Add field').options).map((o) => o.text)).not.toContain('Priority');

    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'duedate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove field Due date' }));
    expect(screen.queryByLabelText('Due date')).toBeNull();
    expect(Array.from(screen.getByLabelText<HTMLSelectElement>('Add field').options).map((o) => o.text)).toContain('Due date');

    // An added field that is left empty is not sent.
    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'labels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-7' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).fields).toEqual({
      customfield_1: { kind: 'option', id: '7' },
      priority: { kind: 'option', id: '1' },
    });
  });

  it('keeps values of fields the new type also has, drops the others and says so', async () => {
    const fetchMock = stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([severity, labelsField, dueDate]),
      'GET /api/jira/projects/SCRUM/issue-types/10001/fields': fieldsRoute([labelsField, priority]),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-8', url: 'u', warnings: [] }),
    });
    show();
    await screen.findByLabelText('Severity (required)');
    fireEvent.change(screen.getByLabelText('Severity (required)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'labels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Labels'), { target: { value: 'voice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'duedate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-01' } });

    fireEvent.change(typeSelect(), { target: { value: '10001' } });

    const notice = await screen.findByText(/Dropped what you entered for/);
    expect(notice.textContent).toContain('Severity');
    expect(notice.textContent).toContain('Due date');
    expect(notice.textContent).not.toContain('Labels');
    expect(screen.getByText('voice')).toBeTruthy();
    expect(screen.queryByLabelText('Due date')).toBeNull();
    expect(screen.queryByLabelText(/Severity/)).toBeNull();

    await waitReady();
    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-8' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).fields).toEqual({ labels: { kind: 'labels', values: ['voice'] } });
  });

  it('drops a chosen option the new type does not allow', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([severity]),
      'GET /api/jira/projects/SCRUM/issue-types/10001/fields': fieldsRoute([{ ...severity, allowedValues: [{ id: '8', name: 'Minor' }] }]),
    });
    show();
    fireEvent.change(await screen.findByLabelText('Severity (required)'), { target: { value: '7' } });
    fireEvent.change(typeSelect(), { target: { value: '10001' } });

    await screen.findByText(/Dropped what you entered for Severity/);
    expect((screen.getByLabelText('Severity (required)') as HTMLSelectElement).value).toBe('');
    expect(createButton().disabled).toBe(true);
  });

  it("shows Jira's message next to the field it names, and not again in the list at the top", async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([severity, labelsField]),
      'POST /api/jira/issues': () =>
        problem(422, 'jira_rejected', { errors: { customfield_1: 'Severity is not valid here', customfield_5: 'Elsewhere' }, errorMessages: [] }),
    });
    show();
    fireEvent.change(await screen.findByLabelText('Severity (required)'), { target: { value: '7' } });
    fireEvent.click(createButton());

    const near = await screen.findByText('Severity is not valid here');
    expect(near.closest('.field')?.querySelector('select')).toBe(screen.getByLabelText('Severity (required)'));
    expect(screen.getAllByText(/Severity is not valid here/)).toHaveLength(1);
    expect(screen.getByText('customfield_5: Elsewhere')).toBeTruthy();
  });
});

describe('CreateInJiraPage links', () => {
  const linkTypes = [
    { name: 'Blocks', inward: 'is blocked by', outward: 'blocks', isDefault: false },
    { name: 'Relates', inward: 'relates to', outward: 'relates to', isDefault: true },
  ];
  const hit = (key: string) => ({ key, summary: `Summary of ${key}`, issueType: 'Story', status: 'To Do' });
  const linkRoutes = () => ({
    ...baseRoutes(),
    'GET /api/jira/link-types': () => jsonResponse(linkTypes),
    'POST /api/jira/issues/search': (_url: string, init?: RequestInit) =>
      jsonResponse([hit(JSON.parse(String(init?.body)).query === 'rep' ? 'SCRUM-12' : 'SCRUM-20')]),
  });

  async function addLinkTo(query: string, key: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    const label = await screen.findAllByLabelText(/Search for issue to link/);
    fireEvent.change(label[label.length - 1], { target: { value: query } });
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${key} `) }));
  }

  it('loads link types on the first Add link, shows both directions as phrases and preselects the default', async () => {
    const fetchMock = stubJiraFetch(linkRoutes());
    show();
    await waitReady();
    expect(callsTo(fetchMock, 'GET /api/jira/link-types')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    const select = await screen.findByLabelText<HTMLSelectElement>('Link type 1');

    expect(Array.from(select.options).map((o) => o.text)).toEqual(['blocks', 'is blocked by', 'relates to']);
    expect(select.selectedOptions[0].text).toBe('relates to');
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await screen.findByLabelText('Link type 2');
    expect(callsTo(fetchMock, 'GET /api/jira/link-types')).toHaveLength(1);
  });

  it('searches across projects, sends typeName, direction and key, and a link can be removed', async () => {
    const fetchMock = stubJiraFetch({ ...linkRoutes(), 'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-30', url: 'u', warnings: [] }) });
    show();
    await waitReady();

    await addLinkTo('rep', 'SCRUM-12');
    fireEvent.change(screen.getByLabelText('Link type 1'), { target: { value: '0:inward' } });
    await addLinkTo('oth', 'SCRUM-20');
    fireEvent.change(screen.getByLabelText('Link type 2'), { target: { value: '0:outward' } });
    await addLinkTo('rep', 'SCRUM-12');
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 3' }));
    expect(screen.queryByLabelText('Link type 3')).toBeNull();

    // The link search has no project or type limits.
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues/search')[0])).toEqual({ projectKey: null, issueTypeIds: null, query: 'rep' });

    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-30' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).links).toEqual([
      { typeName: 'Blocks', direction: 'inward', issueKey: 'SCRUM-12' },
      { typeName: 'Blocks', direction: 'outward', issueKey: 'SCRUM-20' },
    ]);
  });

  it('blocks Create with a reason while a link has no issue, and lets the issue be changed', async () => {
    stubJiraFetch(linkRoutes());
    show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await screen.findByLabelText('Link type 1');

    expect(createButton().disabled).toBe(true);
    expect(screen.getByText('Pick an issue for each link, or remove the link.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search for issue to link 1'), { target: { value: 'rep' } });
    fireEvent.click(await screen.findByRole('button', { name: /SCRUM-12 / }));
    expect(createButton().disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Change issue 1' }));
    expect(createButton().disabled).toBe(true);
    expect(screen.getByLabelText('Search for issue to link 1')).toBeTruthy();
  });

  it('allows up to five links', async () => {
    stubJiraFetch(linkRoutes());
    show();
    await waitReady();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
      await screen.findByLabelText(`Link type ${i + 1}`);
    }
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add link' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 5' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add link' }).disabled).toBe(false);
  });

  it('shows a failure to load link types and lets the user try again', async () => {
    let fail = true;
    stubJiraFetch({ ...linkRoutes(), 'GET /api/jira/link-types': () => (fail ? problem(502, 'jira_unavailable') : jsonResponse(linkTypes)) });
    show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not reach Jira.');
    expect(screen.queryByLabelText('Link type 1')).toBeNull();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await screen.findByLabelText('Link type 1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when the site has no link types', async () => {
    stubJiraFetch({ ...linkRoutes(), 'GET /api/jira/link-types': () => jsonResponse([]) });
    show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await screen.findByText('This Jira site has no link types.');
  });

  it('shows the Connect panel when the link types call finds the session gone', async () => {
    stubJiraFetch({ ...linkRoutes(), 'GET /api/jira/link-types': () => problem(401, 'jira_auth_required') });
    show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await screen.findByLabelText('API token');
  });

  it('names the issue of a failed link in the result', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-31', url: 'u', warnings: [{ code: 'jira_link_failed', issueKey: 'SCRUM-12' }] }),
    });
    show();
    await waitReady();
    fireEvent.click(createButton());
    await screen.findByText('Created SCRUM-31, but the link to SCRUM-12 failed; add it in Jira.');
  });
});

describe('CreateInJiraPage remembered choices', () => {
  const twoProjects = () => ({
    ...baseRoutes(),
    'GET /api/jira/projects/OPS/issue-types': () => jsonResponse(issueTypes),
    'GET /api/jira/projects/OPS/issue-types/10002/fields': () => jsonResponse(noFields),
    'GET /api/jira/projects/OPS/issue-types/10001/fields': () => jsonResponse(noFields),
    'GET /api/jira/projects/OPS/issue-types/10003/fields': () => jsonResponse(noFields),
    'GET /api/jira/projects/SCRUM/issue-types/10003/fields': () => jsonResponse(noFields),
  });
  const stored = () => JSON.parse(localStorage.getItem('vtt.jira.preferences') ?? 'null');

  it('remembers the project and the issue type per ticket type, and uses them on the next visit', async () => {
    stubJiraFetch(twoProjects());
    const first = show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'OPS' } });
    await waitFor(() => expect(typeSelect().value).toBe('10002'));
    await waitReady();
    fireEvent.change(typeSelect(), { target: { value: '10003' } });
    await waitFor(() => expect(createButton().disabled).toBe(false));
    first.unmount();

    show();
    await waitFor(() => expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('OPS'));
    await waitFor(() => expect(typeSelect().value).toBe('10003'));
    expect(stored().projects.OPS.issueTypes).toEqual({ Bug: '10003' });
  });

  it('uses the Feature choice only for a Feature ticket', async () => {
    stubJiraFetch(twoProjects());
    const first = show({ ticketType: 'Feature' });
    await waitReady();
    fireEvent.change(typeSelect(), { target: { value: '10003' } });
    first.unmount();

    show({ ticketType: 'Bug' });
    await waitFor(() => expect(typeSelect().value).toBe('10002'));
  });

  it('ignores a remembered project or type that no longer exists', async () => {
    localStorage.setItem(
      'vtt.jira.preferences',
      JSON.stringify({ version: 1, lastProject: 'GONE', projects: { SCRUM: { issueTypes: { Bug: '99999' } } } }),
    );
    stubJiraFetch(baseRoutes());
    show();
    await waitFor(() => expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('SCRUM'));
    await waitFor(() => expect(typeSelect().value).toBe('10002'));
  });

  it('does not remember what it chose itself, only what the user picked', async () => {
    stubJiraFetch(baseRoutes());
    show();
    await waitReady();
    expect(localStorage.getItem('vtt.jira.preferences')).toBeNull();
  });

  it('remembers the link type and starts the next link with it', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/link-types': () =>
        jsonResponse([
          { name: 'Blocks', inward: 'is blocked by', outward: 'blocks', isDefault: false },
          { name: 'Relates', inward: 'relates to', outward: 'relates to', isDefault: true },
        ]),
    });
    const first = show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.change(await screen.findByLabelText('Link type 1'), { target: { value: '0:outward' } });
    first.unmount();

    show();
    await waitReady();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect((await screen.findByLabelText<HTMLSelectElement>('Link type 1')).selectedOptions[0].text).toBe('blocks');
  });

  it('remembers the optional fields added and shows them again', async () => {
    stubJiraFetch({
      ...baseRoutes(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([priority, labelsField]),
    });
    const first = show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'labels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    first.unmount();

    show();
    expect(await screen.findByLabelText('Labels')).toBeTruthy();
    expect(screen.queryByLabelText('Priority')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove field Labels' }));
    expect(stored().projects.SCRUM.fields).toEqual([]);
  });

  it('stores no ticket text, field values or credentials', async () => {
    stubJiraFetch({
      ...twoProjects(),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': fieldsRoute([labelsField]),
    });
    show();
    await waitReady();
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Secret summary text' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Secret description text' } });
    fireEvent.change(screen.getByLabelText('Add field'), { target: { value: 'labels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Labels'), { target: { value: 'secretlabel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    fireEvent.change(typeSelect(), { target: { value: '10003' } });

    expect(stored()).not.toBeNull();
    const everything = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(everything).not.toMatch(/Secret|secretlabel|Export crashes|It crashes/);
  });

  it('Forget my Jira choices clears them', async () => {
    stubJiraFetch(twoProjects());
    const first = show();
    await waitReady();
    fireEvent.change(typeSelect(), { target: { value: '10003' } });
    expect(stored()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Forget my Jira choices' }));
    expect(localStorage.getItem('vtt.jira.preferences')).toBeNull();
    expect(screen.getByText(/Remembered choices cleared/)).toBeTruthy();
    first.unmount();

    show();
    await waitFor(() => expect(typeSelect().value).toBe('10002'));
  });

  it('works without memory when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const fetchMock = stubJiraFetch({
      ...twoProjects(),
      'POST /api/jira/issues': () => jsonResponse({ key: 'SCRUM-40', url: 'u', warnings: [] }),
    });
    show();
    await waitReady();
    fireEvent.change(typeSelect(), { target: { value: '10003' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forget my Jira choices' }));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(createButton());
    await screen.findByRole('link', { name: 'SCRUM-40' });
    expect(bodyOf(callsTo(fetchMock, 'POST /api/jira/issues')[0]).issueTypeId).toBe('10003');
    vi.restoreAllMocks();
  });
});

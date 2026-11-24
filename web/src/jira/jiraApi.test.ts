import { afterEach, describe, expect, it } from 'vitest';
import { connectJira, createIssue, disconnectJira, getFields, getJiraStatus, JiraApiError } from './jiraApi';
import { bodyOf, jsonResponse, problem, stubJiraFetch } from './fakeJira';

const signal = () => new AbortController().signal;

describe('jiraApi', () => {
  it('reads the status', async () => {
    stubJiraFetch({ 'GET /api/jira/status': () => jsonResponse({ enabled: true, connected: false, displayName: null, defaultProjectKey: 'SCRUM' }) });
    expect(await getJiraStatus(signal())).toMatchObject({ enabled: true, defaultProjectKey: 'SCRUM' });
  });

  it('fills in the address fields a partial status lacks', async () => {
    stubJiraFetch({ 'GET /api/jira/status': () => jsonResponse({ enabled: true, connected: false, displayName: null, defaultProjectKey: null }) });
    expect(await getJiraStatus(signal())).toMatchObject({ siteUrl: null, defaultSiteUrl: null, allowedHosts: [] });
  });

  it('reads the type and sign-in of the status, with defaults when a server sends none', async () => {
    stubJiraFetch({
      'GET /api/jira/status': () =>
        jsonResponse({ enabled: true, connected: true, deployment: 'Server', authScheme: 'Basic', defaultServerAuthScheme: 'Basic' }),
    });
    expect(await getJiraStatus(signal())).toMatchObject({ deployment: 'Server', authScheme: 'Basic', defaultServerAuthScheme: 'Basic' });

    stubJiraFetch({ 'GET /api/jira/status': () => jsonResponse({ enabled: true, connected: false }) });
    expect(await getJiraStatus(signal())).toMatchObject({ deployment: 'Cloud', authScheme: 'Basic', defaultServerAuthScheme: 'Bearer' });
  });

  it('reads the address fields of the status', async () => {
    stubJiraFetch({
      'GET /api/jira/status': () =>
        jsonResponse({ enabled: true, connected: true, siteUrl: 'https://a.atlassian.net', defaultSiteUrl: 'https://b.atlassian.net', allowedHosts: ['*.atlassian.net', 7] }),
    });
    expect(await getJiraStatus(signal())).toMatchObject({
      siteUrl: 'https://a.atlassian.net',
      defaultSiteUrl: 'https://b.atlassian.net',
      allowedHosts: ['*.atlassian.net'],
    });
  });

  it('treats a reply that is not a status as unexpected', async () => {
    stubJiraFetch({ 'GET /api/jira/status': () => jsonResponse({ hello: 1 }) });
    await expect(getJiraStatus(signal())).rejects.toMatchObject({ code: 'unexpected_response' });
  });

  it('accepts the 204 of Disconnect', async () => {
    stubJiraFetch({ 'DELETE /api/jira/session': () => new Response(null, { status: 204 }) });
    await expect(disconnectJira(signal())).resolves.toBeUndefined();
  });

  it('sends the credentials as JSON', async () => {
    const mock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada' }) });
    const request = { siteUrl: 'https://x.atlassian.net', deployment: 'Cloud', authScheme: 'Basic', login: 'a@b.c', secret: 'tok' };
    expect(await connectJira(request, signal())).toBe('Ada');
    expect(bodyOf(mock.mock.calls[0])).toEqual(request);
    expect(new Headers(mock.mock.calls[0][1]?.headers).get('Content-Type')).toBe('application/json');
  });

  it('carries Jira field errors, messages and the retry delay on the error', async () => {
    stubJiraFetch({
      'POST /api/jira/issues': () =>
        problem(422, 'jira_rejected', { errors: { summary: 'Too long', n: 5 }, errorMessages: ['General', 7], retryAfterSeconds: 3 }),
    });
    const error = await createIssue(
      { projectKey: 'S', issueTypeId: '1', summary: 'x', description: '', parentKey: null, fields: {}, links: [] },
      signal(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toMatchObject({
      code: 'jira_rejected',
      status: 422,
      fieldErrors: { summary: 'Too long' },
      messages: ['General'],
      retryAfterSeconds: 3,
    });
  });

  it('maps a failed request to network_error and a non-API body to unexpected_response', async () => {
    stubJiraFetch({ 'GET /api/jira/status': () => Promise.reject(new TypeError('x')) });
    await expect(getJiraStatus(signal())).rejects.toMatchObject({ code: 'network_error' });

    stubJiraFetch({ 'GET /api/jira/status': () => new Response('Bad gateway', { status: 502 }) });
    await expect(getJiraStatus(signal())).rejects.toMatchObject({ code: 'unexpected_response' });
  });
});

// Deployment plan D28: under /alt/ the calls go to /alt/api/jira/..., where the session cookie's path is.
describe('jiraApi under /alt/', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('prefixes the calls with the path the page is served at', async () => {
    window.history.replaceState(null, '', '/alt/');
    const mock = stubJiraFetch({
      'GET /alt/api/jira/status': () => jsonResponse({ enabled: true, connected: false }),
      'DELETE /alt/api/jira/session': () => new Response(null, { status: 204 }),
      'GET /alt/api/jira/projects/A%20B/issue-types/10001/fields': () => jsonResponse({ fields: [], parentTypeIds: [] }),
    });

    await getJiraStatus(signal());
    await disconnectJira(signal());
    await getFields('A B', '10001', signal());

    expect(mock).toHaveBeenCalledTimes(3);
  });
});

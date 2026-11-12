import { describe, expect, it } from 'vitest';
import { connectJira, createIssue, disconnectJira, getJiraStatus, JiraApiError } from './jiraApi';
import { bodyOf, jsonResponse, problem, stubJiraFetch } from './fakeJira';

const signal = () => new AbortController().signal;

describe('jiraApi', () => {
  it('reads the status', async () => {
    stubJiraFetch({ 'GET /api/jira/status': () => jsonResponse({ enabled: true, connected: false, displayName: null, defaultProjectKey: 'SCRUM' }) });
    expect(await getJiraStatus(signal())).toMatchObject({ enabled: true, defaultProjectKey: 'SCRUM' });
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
    expect(await connectJira('a@b.c', 'tok', signal())).toBe('Ada');
    expect(bodyOf(mock.mock.calls[0])).toEqual({ email: 'a@b.c', apiToken: 'tok' });
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

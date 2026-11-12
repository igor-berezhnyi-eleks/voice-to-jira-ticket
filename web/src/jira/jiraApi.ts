import { ApiError } from '../api';
import type { JiraSchema } from '../jiraContract';

export type JiraStatus = JiraSchema['status'];
export type JiraProject = JiraSchema['project'];
export type JiraIssueType = JiraSchema['issueType'];
export type JiraFieldsResponse = JiraSchema['fieldsResponse'];
export type JiraField = JiraFieldsResponse['fields'][number];
export type JiraIssueHit = JiraSchema['issueHit'];
export type CreateIssueRequest = JiraSchema['createIssueRequest'];
export type CreateIssueResponse = JiraSchema['createIssueResponse'];

/** A failed Jira call: the base error plus what Jira said about fields (`jira_rejected`) and when to retry. */
export class JiraApiError extends ApiError {
  /** Jira's messages by field id (`summary`, `description`, ...). */
  readonly fieldErrors: Record<string, string>;
  /** Jira's messages that belong to no field. */
  readonly messages: string[];
  readonly retryAfterSeconds: number | null;

  constructor(
    code: string,
    status: number | null,
    message: string,
    extras: { fieldErrors?: Record<string, string>; messages?: string[]; retryAfterSeconds?: number | null } = {},
  ) {
    super(code, status, message);
    this.name = 'JiraApiError';
    this.fieldErrors = extras.fieldErrors ?? {};
    this.messages = extras.messages ?? [];
    this.retryAfterSeconds = extras.retryAfterSeconds ?? null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function send(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new JiraApiError('network_error', null, 'Could not reach the server.');
  }

  if (response.status === 204) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new JiraApiError('unexpected_response', response.status, `Unexpected response (HTTP ${response.status}).`);
  }
  if (response.ok) return body;

  if (!isRecord(body) || typeof body.code !== 'string') {
    throw new JiraApiError('unexpected_response', response.status, `Unexpected response (HTTP ${response.status}).`);
  }
  const fieldErrors: Record<string, string> = {};
  if (isRecord(body.errors)) {
    for (const [key, value] of Object.entries(body.errors)) {
      if (typeof value === 'string') fieldErrors[key] = value;
    }
  }
  const messages = Array.isArray(body.errorMessages) ? body.errorMessages.filter((m): m is string => typeof m === 'string') : [];
  const retry = typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : null;
  const message = typeof body.detail === 'string' ? body.detail : typeof body.title === 'string' ? body.title : 'The request failed.';
  throw new JiraApiError(body.code, response.status, message, { fieldErrors, messages, retryAfterSeconds: retry });
}

const json = (value: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
});

function expectArray<T>(body: unknown): T[] {
  if (!Array.isArray(body)) throw new JiraApiError('unexpected_response', null, 'Unexpected response.');
  return body as T[];
}

export async function getJiraStatus(signal: AbortSignal): Promise<JiraStatus> {
  const body = await send('/api/jira/status', {}, signal);
  if (!isRecord(body) || typeof body.enabled !== 'boolean') {
    throw new JiraApiError('unexpected_response', null, 'Unexpected response.');
  }
  return body as JiraStatus;
}

export async function connectJira(email: string, apiToken: string, signal: AbortSignal): Promise<string> {
  const body = await send('/api/jira/session', json({ email, apiToken }), signal);
  if (!isRecord(body) || typeof body.displayName !== 'string') {
    throw new JiraApiError('unexpected_response', null, 'Unexpected response.');
  }
  return body.displayName;
}

export async function disconnectJira(signal: AbortSignal): Promise<void> {
  await send('/api/jira/session', { method: 'DELETE' }, signal);
}

export async function getProjects(signal: AbortSignal): Promise<JiraProject[]> {
  return expectArray(await send('/api/jira/projects', {}, signal));
}

export async function getIssueTypes(projectKey: string, signal: AbortSignal): Promise<JiraIssueType[]> {
  return expectArray(await send(`/api/jira/projects/${encodeURIComponent(projectKey)}/issue-types`, {}, signal));
}

export async function getFields(projectKey: string, issueTypeId: string, signal: AbortSignal): Promise<JiraFieldsResponse> {
  const body = await send(
    `/api/jira/projects/${encodeURIComponent(projectKey)}/issue-types/${encodeURIComponent(issueTypeId)}/fields`,
    {},
    signal,
  );
  if (!isRecord(body) || !Array.isArray(body.fields) || !Array.isArray(body.parentTypeIds)) {
    throw new JiraApiError('unexpected_response', null, 'Unexpected response.');
  }
  return body as unknown as JiraFieldsResponse;
}

export async function searchIssues(
  request: JiraSchema['issueSearchRequest'],
  signal: AbortSignal,
): Promise<JiraIssueHit[]> {
  return expectArray(await send('/api/jira/issues/search', json(request), signal));
}

export async function createIssue(request: CreateIssueRequest, signal: AbortSignal): Promise<CreateIssueResponse> {
  const body = await send('/api/jira/issues', json(request), signal);
  if (!isRecord(body) || typeof body.key !== 'string' || typeof body.url !== 'string') {
    throw new JiraApiError('unexpected_response', null, 'Unexpected response.');
  }
  return { key: body.key, url: body.url, warnings: Array.isArray(body.warnings) ? (body.warnings as CreateIssueResponse['warnings']) : [] };
}

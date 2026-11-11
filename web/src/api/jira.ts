import { describeProblem } from './tickets'

export interface JiraBoard {
  id: number
  name: string
  projectKey: string | null
}

export interface JiraIssueRef {
  key: string
  summary: string
}

export interface IssueTypeChoices {
  available: string[]
  suggested: string | null
}

export interface CreatedIssue {
  key: string
  url: string
  warning: string | null
}

// Thrown when Jira says the user is not logged in (no cookie, bad token, expired token).
export class NotConnectedError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (response.ok) {
    return (response.status === 204 ? undefined : await response.json()) as T
  }
  const message = await describeProblem(response)
  throw response.status === 401 ? new NotConnectedError(message) : new Error(message)
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const login = (baseUrl: string, email: string, apiToken: string) =>
  call<{ displayName: string }>('/api/jira/login', post({ baseUrl, email, apiToken }))

export const logout = () => call<void>('/api/jira/logout', { method: 'POST' })

export const getBoards = (name: string) => call<JiraBoard[]>(`/api/jira/boards?name=${encodeURIComponent(name)}`)

export const getParents = (projectKey: string, type: 'Bug' | 'Feature', q: string) =>
  call<JiraIssueRef[]>(
    `/api/jira/parents?projectKey=${encodeURIComponent(projectKey)}&type=${type}&q=${encodeURIComponent(q)}`,
  )

export const getIssueTypes = (projectKey: string, type: 'Bug' | 'Feature') =>
  call<IssueTypeChoices>(`/api/jira/issue-types?projectKey=${encodeURIComponent(projectKey)}&type=${type}`)

export const createIssue = (issue: {
  type: 'Bug' | 'Feature'
  title: string
  description: string
  projectKey: string
  parentKey: string | null
  issueType: string | null
}) => call<CreatedIssue>('/api/jira/issues', post(issue))

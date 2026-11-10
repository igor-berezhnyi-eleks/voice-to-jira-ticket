import { useEffect, useState } from 'react'
import {
  NotConnectedError,
  createIssue,
  getBoards,
  getIssueTypes,
  getParents,
  login,
  logout,
  type CreatedIssue,
  type IssueTypeChoices,
  type JiraBoard,
  type JiraIssueRef,
} from '../api/jira'
import { toWikiMarkup, type EditableTicket } from '../ticket/ticket'

type Connection = 'checking' | 'login' | 'connected'

export function JiraPage(props: { ticket: EditableTicket; onBack: () => void }) {
  const { ticket } = props
  const type = ticket.type
  const title = typeof ticket.fields.title === 'string' ? ticket.fields.title.trim() : ''

  const [connection, setConnection] = useState<Connection>('checking')
  const [baseUrl, setBaseUrl] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [boardQuery, setBoardQuery] = useState('')
  const [boards, setBoards] = useState<JiraBoard[]>([])
  const [boardId, setBoardId] = useState<number | null>(null)
  const [parentQuery, setParentQuery] = useState('')
  const [parents, setParents] = useState<JiraIssueRef[]>([])
  const [parentKey, setParentKey] = useState('')
  const [issueTypes, setIssueTypes] = useState<IssueTypeChoices | null>(null)
  const [issueType, setIssueType] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedIssue | null>(null)

  const board = boards.find((candidate) => candidate.id === boardId) ?? null
  const projectKey = board?.projectKey ?? null

  // Per project: which issue types exist, and whether the configured Bug/Feature mapping matches one of them.
  useEffect(() => {
    setIssueTypes(null)
    setIssueType('')
    if (!projectKey) {
      return
    }
    let cancelled = false
    getIssueTypes(projectKey, type)
      .then((result) => {
        if (!cancelled) {
          setIssueTypes(result)
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          fail(failure)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectKey, type])

  const needsIssueType = issueTypes !== null && issueTypes.suggested === null && issueTypes.available.length > 0

  function fail(failure: unknown) {
    if (failure instanceof NotConnectedError) {
      setConnection('login')
    }
    setError(failure instanceof Error ? failure.message : String(failure))
  }

  async function loadBoards(name: string) {
    setError(null)
    try {
      setBoards(await getBoards(name))
      setConnection('connected')
    } catch (failure) {
      fail(failure)
    }
  }

  // The cookie may already hold a valid login from earlier; boards load only then.
  useEffect(() => {
    let cancelled = false
    getBoards('')
      .then((result) => {
        if (!cancelled) {
          setBoards(result)
          setConnection('connected')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnection('login')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(baseUrl, email, apiToken)
      setApiToken('')
      await loadBoards('')
    } catch (failure) {
      fail(failure)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    await logout()
    setBoards([])
    setBoardId(null)
    setParents([])
    setParentKey('')
    setConnection('login')
  }

  async function searchParents() {
    if (!projectKey) {
      return
    }
    setError(null)
    try {
      setParents(await getParents(projectKey, type, parentQuery))
    } catch (failure) {
      fail(failure)
    }
  }

  async function submitIssue() {
    if (!projectKey) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      setCreated(
        await createIssue({
          type,
          title,
          description: toWikiMarkup(ticket),
          projectKey,
          parentKey: parentKey || null,
          issueType: needsIssueType ? issueType : null,
        }),
      )
    } catch (failure) {
      fail(failure)
    } finally {
      setBusy(false)
    }
  }

  const parentLabel = type === 'Feature' ? 'Epic' : 'Story'

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={props.onBack}>
          Back to ticket
        </button>
        {connection === 'connected' && (
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        )}
      </div>
      <h2>Create in Jira</h2>
      <p className="hint">
        {type}: {title}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {connection === 'checking' && <p className="status">Checking Jira connection...</p>}

      {connection === 'login' && (
        <form onSubmit={submitLogin} className="jira-form">
          <p className="hint">
            Use your Atlassian email and an API token (id.atlassian.com/manage-profile/security/api-tokens). The token
            is kept only in an encrypted cookie in this browser.
          </p>
          <label>
            Jira site
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://your-site.atlassian.net"
              required
            />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            API token
            <input type="password" value={apiToken} onChange={(event) => setApiToken(event.target.value)} required />
          </label>
          <div className="toolbar">
            <button type="submit" disabled={busy}>
              {busy ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      )}

      {connection === 'connected' && !created && (
        <div className="jira-form">
          <label>
            Board
            <div className="toolbar">
              <input value={boardQuery} onChange={(event) => setBoardQuery(event.target.value)} placeholder="Filter by name" />
              <button type="button" onClick={() => loadBoards(boardQuery)}>
                Search boards
              </button>
            </div>
            <select
              value={boardId ?? ''}
              onChange={(event) => {
                setBoardId(event.target.value ? Number(event.target.value) : null)
                setParents([])
                setParentKey('')
              }}
            >
              <option value="">Select a board</option>
              {boards.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.projectKey ? ` (${candidate.projectKey})` : ''}
                </option>
              ))}
            </select>
          </label>
          {board && !projectKey && <p className="error">This board has no project, pick another one.</p>}

          {projectKey && (
            <label>
              Parent {parentLabel} (optional)
              <div className="toolbar">
                <input
                  value={parentQuery}
                  onChange={(event) => setParentQuery(event.target.value)}
                  placeholder="Search by summary"
                />
                <button type="button" onClick={searchParents}>
                  Search {parentLabel.toLowerCase()}s
                </button>
              </div>
              <select value={parentKey} onChange={(event) => setParentKey(event.target.value)}>
                <option value="">No parent</option>
                {parents.map((parent) => (
                  <option key={parent.key} value={parent.key}>
                    {parent.key}: {parent.summary}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsIssueType && (
            <label>
              Issue type
              <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
                <option value="">Select an issue type</option>
                {issueTypes.available.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="hint">
                {projectKey} has no "{type === 'Feature' ? 'Story' : 'Bug'}" issue type. Choose the one to use for this {type.toLowerCase()}.
              </span>
            </label>
          )}

          <div className="toolbar">
            <button type="button" onClick={submitIssue} disabled={!projectKey || busy || (needsIssueType && !issueType)}>
              {busy ? 'Creating...' : 'Create issue'}
            </button>
          </div>
        </div>
      )}

      {created && (
        <div>
          <p>
            Created{' '}
            <a href={created.url} target="_blank" rel="noreferrer">
              {created.key}
            </a>
            .
          </p>
          {created.warning && <p className="error">{created.warning}</p>}
        </div>
      )}
    </section>
  )
}

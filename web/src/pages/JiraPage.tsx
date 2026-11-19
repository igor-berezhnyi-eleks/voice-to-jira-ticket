import { useEffect, useState } from 'react'
import { Alert, Button, Link, MenuItem, Stack, TextField, Typography } from '@eleks-ui/components'
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

const LAST_BOARD_KEY = 'jira.lastBoardId'

export function readLastBoardId(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_BOARD_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function saveLastBoardId(id: number) {
  try {
    localStorage.setItem(LAST_BOARD_KEY, String(id))
  } catch {
    // Storage unavailable; the preselection is only a convenience.
  }
}

export function JiraPage(props: { ticket: EditableTicket; onBack: () => void }) {
  const { ticket } = props
  const type = ticket.type
  const title = typeof ticket.fields.title === 'string' ? ticket.fields.title.trim() : ''

  const [connection, setConnection] = useState<Connection>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

  // Preselect the last used board once it shows up in the loaded list.
  useEffect(() => {
    if (boardId !== null) {
      return
    }
    const last = readLastBoardId()
    if (last !== null && boards.some((candidate) => candidate.id === last)) {
      setBoardId(last)
    }
  }, [boards, boardId])

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
      await login(username, password)
      setPassword('')
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

  const rowSx = { flexWrap: 'wrap', alignItems: 'center' } as const
  const placeholderSelect = { select: { displayEmpty: true }, inputLabel: { shrink: true } }

  return (
    <Stack component="section" spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={props.onBack}>
          Back to ticket
        </Button>
        {connection === 'connected' && (
          <Button variant="outlined" onClick={disconnect}>
            Disconnect
          </Button>
        )}
      </Stack>
      <Typography variant="h5" component="h2">
        Create in Jira
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {type}: {title}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}

      {connection === 'checking' && (
        <Typography variant="body2" color="text.secondary">
          Checking Jira connection...
        </Typography>
      )}

      {connection === 'login' && (
        <Stack
          component="form"
          onSubmit={submitLogin}
          spacing={3}
          sx={{
            maxWidth: 560,
            '& input:-webkit-autofill': {
              WebkitBoxShadow: (theme) => `0 0 0 100px ${theme.palette.background.paper} inset`,
              WebkitTextFillColor: (theme) => theme.palette.text.primary,
              caretColor: (theme) => theme.palette.text.primary,
            },
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Log in to jd.eleks.com with your Jira username and password. They are kept only in an encrypted cookie in
            this browser.
          </Typography>
          <TextField
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Stack direction="row">
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Connecting...' : 'Connect'}
            </Button>
          </Stack>
        </Stack>
      )}

      {connection === 'connected' && !created && (
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={rowSx}>
            <TextField
              label="Board filter"
              value={boardQuery}
              onChange={(event) => setBoardQuery(event.target.value)}
              placeholder="Filter by name"
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={() => loadBoards(boardQuery)}>
              Search boards
            </Button>
          </Stack>
          <TextField
            select
            label="Board"
            value={boardId ?? ''}
            onChange={(event) => {
              const id = event.target.value ? Number(event.target.value) : null
              setBoardId(id)
              if (id !== null) {
                saveLastBoardId(id)
              }
              setParents([])
              setParentKey('')
            }}
            slotProps={placeholderSelect}
          >
            <MenuItem value="">Select a board</MenuItem>
            {boards.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.name}
                {candidate.projectKey ? ` (${candidate.projectKey})` : ''}
              </MenuItem>
            ))}
          </TextField>
          {board && !projectKey && <Alert severity="error">This board has no project, pick another one.</Alert>}

          {projectKey && (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={rowSx}>
                <TextField
                  label={`Parent ${parentLabel} search (optional)`}
                  value={parentQuery}
                  onChange={(event) => setParentQuery(event.target.value)}
                  placeholder="Search by summary"
                  sx={{ flex: 1 }}
                />
                <Button variant="outlined" onClick={searchParents}>
                  Search {parentLabel.toLowerCase()}s
                </Button>
              </Stack>
              <TextField
                select
                label={`Parent ${parentLabel} (optional)`}
                value={parentKey}
                onChange={(event) => setParentKey(event.target.value)}
                slotProps={placeholderSelect}
              >
                <MenuItem value="">No parent</MenuItem>
                {parents.map((parent) => (
                  <MenuItem key={parent.key} value={parent.key}>
                    {parent.key}: {parent.summary}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}

          {needsIssueType && (
            <TextField
              select
              label="Issue type"
              value={issueType}
              onChange={(event) => setIssueType(event.target.value)}
              slotProps={placeholderSelect}
              helperText={`${projectKey} has no "${type === 'Feature' ? 'Story' : 'Bug'}" issue type. Choose the one to use for this ${type.toLowerCase()}.`}
            >
              <MenuItem value="">Select an issue type</MenuItem>
              {issueTypes.available.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Stack direction="row">
            <Button
              variant="contained"
              onClick={submitIssue}
              disabled={!projectKey || busy || (needsIssueType && !issueType)}
            >
              {busy ? 'Creating...' : 'Create issue'}
            </Button>
          </Stack>
        </Stack>
      )}

      {created && (
        <Stack spacing={1}>
          <Alert severity="success">
            Created{' '}
            <Link href={created.url} target="_blank" rel="noreferrer">
              {created.key}
            </Link>
            .
          </Alert>
          {created.warning && <Alert severity="warning">{created.warning}</Alert>}
        </Stack>
      )}
    </Stack>
  )
}

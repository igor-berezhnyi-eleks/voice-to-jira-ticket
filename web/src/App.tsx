import { useEffect, useState } from 'react'
import { Box, Container, IconButton, Typography } from '@eleks-ui/components'
import { useEleksUITheme } from '@eleks-ui/theme'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { createIssue, getBoards, getIssueTypes, type CreatedIssue, type JiraBoard } from './api/jira'
import { generateTicket } from './api/tickets'
import { ProgressSteps } from './components/ProgressSteps'
import { JiraPage, readLastBoard } from './pages/JiraPage'
import { TicketPage } from './pages/TicketPage'
import { VoicePage } from './pages/VoicePage'
import { fromGenerated, missingRequired, toWikiMarkup, type EditableTicket } from './ticket/ticket'

const PAGES = ['voice', 'ticket', 'jira'] as const
const STEPS = [{ title: 'Voice report' }, { title: 'Ticket' }, { title: 'Jira' }]

function App() {
  const [page, setPage] = useState<(typeof PAGES)[number]>('voice')
  const [transcript, setTranscript] = useState('')
  const [ticket, setTicket] = useState<EditableTicket | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boards, setBoards] = useState<JiraBoard[] | null>(null)
  const [lastProjectKey, setLastProjectKey] = useState<string | null>(null)
  const [quickCreating, setQuickCreating] = useState(false)
  const [quickCreated, setQuickCreated] = useState<CreatedIssue | null>(null)
  const { mode, toggleTheme } = useEleksUITheme()

  // Quick create needs a Jira login (boards load only then) and a remembered board; re-checked whenever page 1 is shown.
  useEffect(() => {
    if (page !== 'voice') {
      return
    }
    setLastProjectKey(readLastBoard()?.projectKey ?? null)
    let cancelled = false
    getBoards('')
      .then((result) => !cancelled && setBoards(result))
      .catch(() => !cancelled && setBoards(null))
    return () => {
      cancelled = true
    }
  }, [page])

  async function quickCreate() {
    setQuickCreating(true)
    setError(null)
    setQuickCreated(null)
    try {
      const generated = fromGenerated(await generateTicket(transcript))
      setTicket(generated)
      const blocking = missingRequired(generated)
      if (blocking.length > 0) {
        throw new Error('The generated ticket is missing required fields. Use Generate ticket to review and complete it.')
      }
      const projectKey = lastProjectKey
      if (!projectKey) {
        throw new Error('No board was used before. Use Generate ticket and pick a board.')
      }
      const choices = await getIssueTypes(projectKey, generated.type)
      if (choices.suggested === null && choices.available.length > 0) {
        throw new Error(`${projectKey} has no matching issue type. Use Generate ticket and pick one.`)
      }
      setQuickCreated(
        await createIssue({
          type: generated.type,
          title: String(generated.fields.title).trim(),
          description: toWikiMarkup(generated),
          projectKey,
          parentKey: null,
          issueType: null,
        }),
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setQuickCreating(false)
    }
  }

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      setTicket(fromGenerated(await generateTicket(transcript)))
      setPage('ticket')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setGenerating(false)
    }
  }

  function regenerate() {
    if (window.confirm('Regenerate the ticket from the transcript? Your edits to the fields will be replaced.')) {
      void generate()
    }
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h4" component="h1">
          Voice to Jira
        </Typography>
        <IconButton
          onClick={toggleTheme}
          aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Box>
      <ProgressSteps
        steps={STEPS}
        current={PAGES.indexOf(page)}
        onNavigate={index => {
          setError(null)
          setPage(PAGES[index])
        }}
      />
      {/* Page 1 stays mounted so the recording, the speech model and the transcript survive navigation. */}
      <div hidden={page !== 'voice'}>
        <VoicePage
          transcript={transcript}
          onTranscriptChange={setTranscript}
          onGenerate={generate}
          generating={generating || quickCreating}
          error={page === 'voice' ? error : null}
          canQuickCreate={boards !== null && lastProjectKey !== null}
          onQuickCreate={quickCreate}
          quickCreating={quickCreating}
          quickCreated={quickCreated}
        />
      </div>
      {page === 'ticket' && ticket && (
        <TicketPage
          ticket={ticket}
          onChange={setTicket}
          onBack={() => {
            setError(null)
            setPage('voice')
          }}
          onRegenerate={regenerate}
          onConnect={() => setPage('jira')}
          generating={generating}
          error={error}
        />
      )}
      {page === 'jira' && ticket && <JiraPage ticket={ticket} onBack={() => setPage('ticket')} />}
      </Container>
    </Box>
  )
}

export default App

import { useState } from 'react'
import { Box, Container, IconButton, Typography } from '@eleks-ui/components'
import { useEleksUITheme } from '@eleks-ui/theme'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { generateTicket } from './api/tickets'
import { ProgressSteps } from './components/ProgressSteps'
import { JiraPage } from './pages/JiraPage'
import { TicketPage } from './pages/TicketPage'
import { VoicePage } from './pages/VoicePage'
import { fromGenerated, type EditableTicket } from './ticket/ticket'

const PAGES = ['voice', 'ticket', 'jira'] as const
const STEPS = [{ title: 'Voice report' }, { title: 'Ticket' }, { title: 'Jira' }]

function App() {
  const [page, setPage] = useState<(typeof PAGES)[number]>('voice')
  const [transcript, setTranscript] = useState('')
  const [ticket, setTicket] = useState<EditableTicket | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, toggleTheme } = useEleksUITheme()

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
          generating={generating}
          error={page === 'voice' ? error : null}
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

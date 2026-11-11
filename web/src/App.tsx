import { useState } from 'react'
import { generateTicket } from './api/tickets'
import { JiraPage } from './pages/JiraPage'
import { TicketPage } from './pages/TicketPage'
import { VoicePage } from './pages/VoicePage'
import { fromGenerated, type EditableTicket } from './ticket/ticket'

function App() {
  const [page, setPage] = useState<'voice' | 'ticket' | 'jira'>('voice')
  const [transcript, setTranscript] = useState('')
  const [ticket, setTicket] = useState<EditableTicket | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <main>
      <h1>Voice to Jira</h1>
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
    </main>
  )
}

export default App

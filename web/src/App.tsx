import { useEffect, useState } from 'react';
import type { GenerateTicketResponse, Ticket } from './api';
import { CreateInJiraPage } from './jira/CreateInJiraPage';
import { getJiraStatus, type JiraStatus } from './jira/jiraApi';
import { ReportPage } from './report/ReportPage';
import { TicketPage } from './ticket/TicketPage';

interface JiraDraft {
  summary: string;
  description: string;
  ticketType: Ticket['type'];
  status: JiraStatus;
}

export function App() {
  const [page, setPage] = useState<'report' | 'ticket' | 'jira'>('report');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<GenerateTicketResponse | null>(null);
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [jiraDraft, setJiraDraft] = useState<JiraDraft | null>(null);

  // Asked once, when Page 2 first shows. A failed call leaves Jira off.
  const onTicketPage = page !== 'report';
  useEffect(() => {
    if (!onTicketPage || jiraStatus !== null) return;
    const controller = new AbortController();
    getJiraStatus(controller.signal)
      .then(setJiraStatus)
      .catch(() => undefined);
    return () => controller.abort();
  }, [onTicketPage, jiraStatus]);

  function showTicket(response: GenerateTicketResponse) {
    setResult(response);
    setPage('ticket');
  }

  async function openJira(ticket: Ticket, wikiText: string) {
    // The session may have ended since Page 2 opened, so ask again; the earlier answer is the fallback.
    let status = jiraStatus;
    try {
      status = await getJiraStatus(new AbortController().signal);
      setJiraStatus(status);
    } catch {
      // keep the earlier answer
    }
    if (!status?.enabled) return;
    setJiraDraft({
      summary: ticket.title === 'Not provided' ? '' : ticket.title,
      description: wikiText,
      ticketType: ticket.type,
      status,
    });
    setPage('jira');
  }

  return (
    <main>
      {result?.provider === 'Fake' && <p className="banner">Fake generator active — tickets are not real</p>}
      {result && page !== 'report' ? (
        // Kept mounted (hidden) on Page 3, so Page 2's edits are still there after Back.
        <div hidden={page === 'jira'}>
          <TicketPage
            response={result}
            transcript={transcript}
            onBack={() => setPage('report')}
            onRegenerated={setResult}
            jiraEnabled={jiraStatus?.enabled === true}
            onConnectJira={(ticket, wikiText) => void openJira(ticket, wikiText)}
          />
        </div>
      ) : (
        <ReportPage transcript={transcript} onTranscriptChange={setTranscript} onGenerated={showTicket} />
      )}
      {page === 'jira' && jiraDraft && <CreateInJiraPage {...jiraDraft} onBack={() => setPage('ticket')} />}
    </main>
  );
}

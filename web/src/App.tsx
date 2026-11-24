import { useEffect, useState } from 'react';
import type { GenerateTicketResponse, Ticket } from './api';
import { Alert } from '@eleks-ui/components';
import { useT } from './i18n/LanguageProvider';
import { AppShell } from './layout/AppShell';
import { CreateInJiraPage } from './jira/CreateInJiraPage';
import { getJiraStatus, type JiraStatus } from './jira/jiraApi';
import { ReportPage } from './report/ReportPage';
import { TicketPage } from './ticket/TicketPage';

interface JiraDraft {
  summary: string;
  description: string;
  /** Absent when Page 3 was opened from Page 1 without a ticket. */
  ticketType?: Ticket['type'];
  /** The page Page 3 was opened from, and Back returns to. */
  from: 'report' | 'ticket';
  status: JiraStatus;
}

export function App() {
  const t = useT();
  const [page, setPage] = useState<'report' | 'ticket' | 'jira'>('report');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<GenerateTicketResponse | null>(null);
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [jiraDraft, setJiraDraft] = useState<JiraDraft | null>(null);

  // Asked when the app first shows (Page 1 has a Jira button too). A failed call leaves Jira off and is
  // asked again on the next page change.
  useEffect(() => {
    if (jiraStatus !== null) return;
    const controller = new AbortController();
    getJiraStatus(controller.signal)
      .then(setJiraStatus)
      .catch(() => undefined);
    return () => controller.abort();
  }, [page, jiraStatus]);

  function showTicket(response: GenerateTicketResponse) {
    setResult(response);
    setPage('ticket');
  }

  /** The session may have ended since the page opened, so ask again; the earlier answer is the fallback. */
  async function freshJiraStatus(): Promise<JiraStatus | null> {
    try {
      const status = await getJiraStatus(new AbortController().signal);
      setJiraStatus(status);
      return status;
    } catch {
      return jiraStatus;
    }
  }

  async function openJira(ticket: Ticket, wikiText: string) {
    const status = await freshJiraStatus();
    if (!status?.enabled) return;
    setJiraDraft({
      summary: ticket.title === 'Not provided' ? '' : ticket.title,
      description: wikiText,
      ticketType: ticket.type,
      from: 'ticket',
      status,
    });
    setPage('jira');
  }

  /** Page 1 → Page 3 without a ticket: the report text is the description, the summary is left to the user. */
  async function openJiraFromReport(text: string) {
    const status = await freshJiraStatus();
    if (!status?.enabled) return;
    // An older generated ticket would come back on Page 2 later; Page 1's Generate replaces it anyway.
    setResult(null);
    setJiraDraft({ summary: '', description: text, from: 'report', status });
    setPage('jira');
  }

  return (
    <main>
      <AppShell activeStep={page === 'report' ? 0 : page === 'ticket' ? 1 : 2}>
      {result?.provider === 'Fake' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t.fakeBanner}
        </Alert>
      )}
      {page === 'report' && (
        <ReportPage
          transcript={transcript}
          onTranscriptChange={setTranscript}
          onGenerated={showTicket}
          jiraEnabled={jiraStatus?.enabled === true}
          onOpenJira={(text) => void openJiraFromReport(text)}
        />
      )}
      {result && page !== 'report' && (
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
      )}
      {page === 'jira' && jiraDraft && (
        <CreateInJiraPage {...jiraDraft} onBack={() => setPage(jiraDraft.from === 'report' ? 'report' : 'ticket')} />
      )}
      </AppShell>
    </main>
  );
}

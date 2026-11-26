import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerateTicketResponse, Ticket } from './api';
import { Alert } from '@eleks-ui/components';
import { useT } from './i18n/LanguageProvider';
import { AppShell } from './layout/AppShell';
import { sameSteps, type PageNavigation, type StepState } from './layout/PageHeader';
import { CreateInJiraPage } from './jira/CreateInJiraPage';
import { getJiraStatus, type JiraStatus } from './jira/jiraApi';
import { ReportPage, type GenerateNext } from './report/ReportPage';
import { renderJiraWiki } from './ticket/render/jiraWiki';
import { TicketPage, uneditedTicket } from './ticket/TicketPage';

interface JiraDraft {
  summary: string;
  description: string;
  ticketType: Ticket['type'];
  status: JiraStatus;
}

type Page = 'report' | 'ticket' | 'jira';
const stepOf: Record<Page, number> = { report: 0, ticket: 1, jira: 2 };

export function App() {
  const t = useT();
  const [page, setPage] = useState<Page>('report');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<GenerateTicketResponse | null>(null);
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [jiraDraft, setJiraDraft] = useState<JiraDraft | null>(null);
  /** Whether the ticket on Page 2 has edits; Page 3 → Page 1 loses them too, so Page 3 asks. */
  const [ticketEdits, setTicketEdits] = useState(false);

  // The header steps: the shown page reports what each step does (it runs its own confirmation), so the
  // decision stays with the page that owns the edits. The handler changes every render; only states re-render.
  const [steps, setSteps] = useState<StepState[] | undefined>(undefined);
  const stepHandler = useRef<((step: number) => void) | null>(null);
  const reportNavigation = useCallback((navigation: PageNavigation) => {
    stepHandler.current = navigation.go;
    setSteps((previous) => (sameSteps(previous, navigation.steps) ? previous : navigation.steps));
  }, []);

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

  /**
   * Generate shows Page 2. Go to Jira (N3) opens Page 3 as Page 2's Connect to Jira would for the untouched ticket,
   * with Page 2 mounted hidden behind it; when Jira turns out to be off, Page 2 shows instead.
   */
  async function showGenerated(response: GenerateTicketResponse, next: GenerateNext) {
    if (next === 'jira') {
      const ticket = uneditedTicket(response.ticket);
      await openJira(ticket, renderJiraWiki(ticket), response);
      return;
    }
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

  /** Opens Page 3 for `ticket`. `generated` is a new ticket from Page 1: it becomes Page 2's ticket either way. */
  async function openJira(ticket: Ticket, wikiText: string, generated?: GenerateTicketResponse) {
    const status = await freshJiraStatus();
    if (generated) setResult(generated);
    if (!status?.enabled) {
      if (generated) setPage('ticket');
      return;
    }
    setJiraDraft({
      summary: ticket.title === 'Not provided' ? '' : ticket.title,
      description: wikiText,
      ticketType: ticket.type,
      status,
    });
    setPage('jira');
  }

  /** Page 3 was left (after its question): Report shows Page 1, Review shows Page 2. */
  function leaveJira(step: number) {
    setPage(step === 1 ? 'ticket' : 'report');
  }

  return (
    <main>
      <AppShell activeStep={stepOf[page]} steps={steps} onStep={(step) => stepHandler.current?.(step)}>
      {result?.provider === 'Fake' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t.fakeBanner}
        </Alert>
      )}
      {page === 'report' && (
        <ReportPage
          transcript={transcript}
          onTranscriptChange={setTranscript}
          onGenerated={showGenerated}
          jiraEnabled={jiraStatus?.enabled === true}
          onNavigation={reportNavigation}
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
            onNavigation={page === 'ticket' ? reportNavigation : undefined}
            onEditsChange={setTicketEdits}
          />
        </div>
      )}
      {page === 'jira' && jiraDraft && (
        <CreateInJiraPage
          {...jiraDraft}
          onBack={() => leaveJira(1)}
          ticketEdits={ticketEdits}
          onStep={leaveJira}
          onNavigation={reportNavigation}
        />
      )}
      </AppShell>
    </main>
  );
}

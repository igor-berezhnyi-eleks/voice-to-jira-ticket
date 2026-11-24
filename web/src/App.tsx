import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerateTicketResponse, Ticket } from './api';
import { Alert } from '@eleks-ui/components';
import { useT } from './i18n/LanguageProvider';
import { AppShell } from './layout/AppShell';
import { sameSteps, type PageNavigation, type StepState } from './layout/PageHeader';
import { CreateInJiraPage } from './jira/CreateInJiraPage';
import { getJiraStatus, type JiraStatus } from './jira/jiraApi';
import { minTranscriptLength, ReportPage } from './report/ReportPage';
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
  /** Set when Page 3's Review step (opened from Page 1) should run Generate as Page 1 shows again. */
  const [generateOnOpen, setGenerateOnOpen] = useState(false);

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

  /** Page 3 was left (after its question): Report shows Page 1; Review shows Page 2, or generates when there is none. */
  function leaveJira(step: number) {
    if (step === 1 && jiraDraft?.from === 'ticket') {
      setPage('ticket');
      return;
    }
    if (step === 1) setGenerateOnOpen(true);
    setPage('report');
  }

  // Page 3 opened from Page 1: Review runs Generate with the Page 1 text, so it is blocked when Generate would be.
  const reviewFromJiraReason =
    jiraDraft?.from === 'report' && transcript.length < minTranscriptLength
      ? t.stepReasons.textTooShort(minTranscriptLength)
      : undefined;

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
          onGenerated={showTicket}
          jiraEnabled={jiraStatus?.enabled === true}
          onOpenJira={(text) => void openJiraFromReport(text)}
          onNavigation={reportNavigation}
          generateOnOpen={generateOnOpen}
          onGenerateStarted={() => setGenerateOnOpen(false)}
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
          onBack={() => leaveJira(jiraDraft.from === 'report' ? 0 : 1)}
          ticketEdits={jiraDraft.from === 'ticket' && ticketEdits}
          reviewDisabledReason={reviewFromJiraReason}
          onStep={leaveJira}
          onNavigation={reportNavigation}
        />
      )}
      </AppShell>
    </main>
  );
}

import { useState } from 'react';
import type { GenerateTicketResponse } from './api';
import { ReportPage } from './report/ReportPage';
import { TicketPage } from './ticket/TicketPage';

export function App() {
  const [page, setPage] = useState<'report' | 'ticket'>('report');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<GenerateTicketResponse | null>(null);

  function showTicket(response: GenerateTicketResponse) {
    setResult(response);
    setPage('ticket');
  }

  return (
    <main>
      {result?.provider === 'Fake' && <p className="banner">Fake generator active — tickets are not real</p>}
      {page === 'ticket' && result ? (
        <TicketPage response={result} onBack={() => setPage('report')} />
      ) : (
        <ReportPage transcript={transcript} onTranscriptChange={setTranscript} onGenerated={showTicket} />
      )}
    </main>
  );
}

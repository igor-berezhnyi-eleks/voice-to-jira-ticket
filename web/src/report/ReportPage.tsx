import { useEffect, useRef, useState } from 'react';
import { ApiError, generateTicket, type GenerateTicketResponse } from '../api';

// The API's lower limit (plan 4.4). It counts raw characters, as the API does.
const minTranscriptLength = 20;

interface ReportPageProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onGenerated: (response: GenerateTicketResponse) => void;
}

export function ReportPage({ transcript, onTranscriptChange, onGenerated }: ReportPageProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function generate() {
    const controller = new AbortController();
    request.current = controller;
    setRunning(true);
    setError(null);
    try {
      onGenerated(await generateTicket(transcript, controller.signal));
    } catch (failure) {
      if (controller.signal.aborted) {
        return;
      }
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <h1>Report</h1>
      <label htmlFor="transcript">Transcript</label>
      <textarea
        id="transcript"
        rows={12}
        value={transcript}
        onChange={(event) => onTranscriptChange(event.target.value)}
      />
      <p className="hint">
        {transcript.length} characters, at least {minTranscriptLength} needed
      </p>
      <button type="button" disabled={running || transcript.length < minTranscriptLength} onClick={generate}>
        Generate ticket
      </button>
      {running && <p role="status">Generating…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}

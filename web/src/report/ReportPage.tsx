import { useCallback, useEffect, useRef, useState } from 'react';
import { generateTicket, type GenerateTicketResponse } from '../api';
import { describeGenerationError, type ErrorDescription } from '../errorMessages';
import { acceptedExtensions } from '../recording/audioFile';
import { appendTranscript, formatElapsed, maxRecordingSeconds } from '../recording/recorderReducer';
import { useRecorder } from '../recording/useRecorder';

// The API's lower limit (plan 4.4). It counts raw characters, as the API does.
const minTranscriptLength = 20;

interface ReportPageProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onGenerated: (response: GenerateTicketResponse) => void;
}

export function ReportPage({ transcript, onTranscriptChange, onGenerated }: ReportPageProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Dictated text is appended to what is in the box when the result arrives, not when recording began.
  const latest = useRef({ transcript, onTranscriptChange });
  useEffect(() => {
    latest.current = { transcript, onTranscriptChange };
  }, [transcript, onTranscriptChange]);
  const appendDictation = useCallback((text: string) => {
    latest.current.onTranscriptChange(appendTranscript(latest.current.transcript, text));
  }, []);
  const recorder = useRecorder(appendDictation);
  const { status, elapsedSeconds, error: recorderError, notice } = recorder.state;
  const recordingBusy = status === 'requesting' || status === 'recording' || status === 'transcribing';

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
      setError(describeGenerationError(failure));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <h1>Report</h1>
      <div className="recorder">
        <button type="button" disabled={running || status === 'transcribing'} onClick={recorder.toggle}>
          {status === 'recording' || status === 'requesting' ? 'Stop' : 'Record'}
        </button>
        <button type="button" disabled={running || recordingBusy} onClick={() => fileInput.current?.click()}>
          Upload recording
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Audio file"
          accept={acceptedExtensions.join(',')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ''; // so choosing the same file again fires another change
            if (file) {
              recorder.uploadFile(file);
            }
          }}
        />
        {status === 'recording' && (
          <span className="timer">
            Recording {formatElapsed(elapsedSeconds)} / {formatElapsed(maxRecordingSeconds)}
          </span>
        )}
        {status === 'requesting' && <span role="status">Waiting for the microphone…</span>}
        {status === 'transcribing' && <span role="status">Transcribing…</span>}
        {status === 'error' && recorder.canRetry && (
          <button type="button" disabled={running} onClick={recorder.retry}>
            Try again
          </button>
        )}
        {recorder.hasRecording && status !== 'recording' && (
          <button type="button" onClick={recorder.download}>
            Download recording
          </button>
        )}
      </div>
      <p className="hint">
        Record or upload a spoken report (English; .wav, .mp3, .webm or .ogg, up to 5 minutes and 25 MB), or type it
        below. Check the text, then generate the ticket.
      </p>
      {recorderError && (
        <p role="alert" className="error">
          {recorderError}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
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
      <button type="button" disabled={running || recordingBusy || transcript.length < minTranscriptLength} onClick={generate}>
        Generate ticket
      </button>
      {running && <p role="status">Generating…</p>}
      {error && (
        <div className="error-row">
          <p role="alert" className="error">
            {error.message}
          </p>
          {error.retryable && (
            <button type="button" disabled={running || recordingBusy || transcript.length < minTranscriptLength} onClick={generate}>
              Retry
            </button>
          )}
        </div>
      )}
    </>
  );
}

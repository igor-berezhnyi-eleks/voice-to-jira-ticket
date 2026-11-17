import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, MenuItem, Stack, TextField, Typography } from '@eleks-ui/components';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DownloadIcon from '@mui/icons-material/Download';
import MicIcon from '@mui/icons-material/Mic';
import ReplayIcon from '@mui/icons-material/Replay';
import StopIcon from '@mui/icons-material/Stop';
import TranslateIcon from '@mui/icons-material/Translate';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { generateTicket, type GenerateTicketResponse } from '../api';
import { describeGenerationError, type ErrorDescription } from '../errorMessages';
import { PageCard } from '../layout/AppShell';
import { acceptedExtensions } from '../recording/audioFile';
import { appendTranscript, formatElapsed, maxRecordingSeconds } from '../recording/recorderReducer';
import { useRecorder } from '../recording/useRecorder';

// The API's lower limit (plan 4.4). It counts raw characters, as the API does.
const minTranscriptLength = 20;
// The API's upper limit (GenerateTicketRequest.MaxTranscriptLength). Only the hint uses it; the API still decides.
const maxTranscriptLength = 20_000;
// UI only for now: translation is not wired up yet.
const translationLanguages = ['English', 'Ukrainian'];

interface ReportPageProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onGenerated: (response: GenerateTicketResponse) => void;
}

export function ReportPage({ transcript, onTranscriptChange, onGenerated }: ReportPageProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [language, setLanguage] = useState('English');
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
  const recordingActive = status === 'recording' || status === 'requesting';
  const generateDisabled = running || recordingBusy || transcript.length < minTranscriptLength;

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
      <PageCard>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 600 }}>
          Describe the bug or feature
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Record or upload a spoken report (English; .wav, .mp3, .webm or .ogg, up to 5 minutes and 25 MB), or type it
          below. Record or upload more to append more text to the transcript. Check the text, then generate the ticket.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={recordingActive ? <StopIcon /> : <MicIcon />}
            disabled={running || status === 'transcribing'}
            onClick={recorder.toggle}
          >
            {recordingActive ? 'Stop' : 'Record'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={running || recordingBusy}
            onClick={() => fileInput.current?.click()}
          >
            Upload recording
          </Button>
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
            <Typography variant="body2">
              Recording {formatElapsed(elapsedSeconds)} / {formatElapsed(maxRecordingSeconds)}
            </Typography>
          )}
          {status === 'requesting' && (
            <Typography variant="body2" role="status">
              Waiting for the microphone…
            </Typography>
          )}
          {status === 'transcribing' && (
            <Typography variant="body2" role="status">
              Transcribing…
            </Typography>
          )}
          {status === 'error' && recorder.canRetry && (
            <Button variant="outlined" startIcon={<ReplayIcon />} disabled={running} onClick={recorder.retry}>
              Try again
            </Button>
          )}
          {recorder.hasRecording && status !== 'recording' && (
            <Button variant="text" startIcon={<DownloadIcon />} onClick={recorder.download}>
              Download recording
            </Button>
          )}
        </Stack>
        {recorderError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {recorderError}
          </Alert>
        )}
        {notice && (
          <Alert severity="info" role="status" sx={{ mb: 2 }}>
            {notice}
          </Alert>
        )}
        <TextField
          id="transcript"
          label="Transcript"
          multiline
          rows={10}
          fullWidth
          value={transcript}
          onChange={(event) => onTranscriptChange(event.target.value)}
        />
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            {transcript.length > maxTranscriptLength
              ? `${transcript.length} characters, over the ${maxTranscriptLength.toLocaleString('en-US')}-character limit`
              : `${transcript.length} characters, at least ${minTranscriptLength} needed`}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              sx={{ minWidth: 140 }}
            >
              {translationLanguages.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<TranslateIcon />}
              disabled={running || recordingBusy || transcript.length === 0}
            >
              Translate
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          {running && (
            <Typography variant="body2" role="status">
              Generating…
            </Typography>
          )}
          <Button variant="contained" endIcon={<ArrowForwardIcon />} disabled={generateDisabled} onClick={generate}>
            Generate ticket
          </Button>
        </Stack>
        {error && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
            <Alert severity="error" sx={{ flexGrow: 1 }}>
              {error.message}
            </Alert>
            {error.retryable && (
              <Button variant="outlined" disabled={generateDisabled} onClick={generate}>
                Retry
              </Button>
            )}
          </Stack>
        )}
      </PageCard>
    </>
  );
}

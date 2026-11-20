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
import { describeGenerationError } from '../errorMessages';
import { useT } from '../i18n/LanguageProvider';
import { languages } from '../i18n/languages';
import { PageCard } from '../layout/AppShell';
import { acceptedExtensions } from '../recording/audioFile';
import { appendTranscript, formatElapsed, maxRecordingSeconds, noSpeechNotice } from '../recording/recorderReducer';
import { useRecorder } from '../recording/useRecorder';

// The API's lower limit (plan 4.4). It counts raw characters, as the API does.
const minTranscriptLength = 20;
// The API's upper limit (GenerateTicketRequest.MaxTranscriptLength). Only the hint uses it; the API still decides.
const maxTranscriptLength = 20_000;

interface ReportPageProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onGenerated: (response: GenerateTicketResponse) => void;
}

export function ReportPage({ transcript, onTranscriptChange, onGenerated }: ReportPageProps) {
  const [running, setRunning] = useState(false);
  // The failure itself is kept, so its message is written in the language active when it is shown.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  // UI only for now: translation is not wired up yet (L7).
  const [language, setLanguage] = useState<string>(languages[0].code);
  const t = useT();
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
  const error = failure ? describeGenerationError(failure.error, t) : null;
  const generateDisabled = running || recordingBusy || transcript.length < minTranscriptLength;

  useEffect(() => () => request.current?.abort(), []);

  async function generate() {
    const controller = new AbortController();
    request.current = controller;
    setRunning(true);
    setFailure(null);
    try {
      onGenerated(await generateTicket(transcript, controller.signal));
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setFailure({ error: caught });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageCard>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 600 }}>
          {t.reportTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          {t.reportHint}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={recordingActive ? <StopIcon /> : <MicIcon />}
            disabled={running || status === 'transcribing'}
            onClick={recorder.toggle}
          >
            {recordingActive ? t.stop : t.record}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={running || recordingBusy}
            onClick={() => fileInput.current?.click()}
          >
            {t.uploadRecording}
          </Button>
          <input
            ref={fileInput}
            type="file"
            hidden
            aria-label={t.audioFile}
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
              {t.recordingTimer(formatElapsed(elapsedSeconds), formatElapsed(maxRecordingSeconds))}
            </Typography>
          )}
          {status === 'requesting' && (
            <Typography variant="body2" role="status">
              {t.waitingForMicrophone}
            </Typography>
          )}
          {status === 'transcribing' && (
            <Typography variant="body2" role="status">
              {t.transcribing}
            </Typography>
          )}
          {status === 'error' && recorder.canRetry && (
            <Button variant="outlined" startIcon={<ReplayIcon />} disabled={running} onClick={recorder.retry}>
              {t.tryAgain}
            </Button>
          )}
          {recorder.hasRecording && status !== 'recording' && (
            <Button variant="text" startIcon={<DownloadIcon />} onClick={recorder.download}>
              {t.downloadRecording}
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
            {notice === noSpeechNotice ? t.noSpeech : notice}
          </Alert>
        )}
        <TextField
          id="transcript"
          label={t.transcript}
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
              ? t.charactersOverLimit(transcript.length, maxTranscriptLength)
              : t.charactersNeeded(transcript.length, minTranscriptLength)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label={t.language}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              sx={{ minWidth: 140 }}
            >
              {languages.map(({ code, name }) => (
                <MenuItem key={code} value={code}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<TranslateIcon />}
              disabled={running || recordingBusy || transcript.length === 0}
            >
              {t.translate}
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          {running && (
            <Typography variant="body2" role="status">
              {t.generating}
            </Typography>
          )}
          <Button variant="contained" endIcon={<ArrowForwardIcon />} disabled={generateDisabled} onClick={generate}>
            {t.generateTicket}
          </Button>
        </Stack>
        {error && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
            <Alert severity="error" sx={{ flexGrow: 1 }}>
              {error.message}
            </Alert>
            {error.retryable && (
              <Button variant="outlined" disabled={generateDisabled} onClick={generate}>
                {t.retry}
              </Button>
            )}
          </Stack>
        )}
      </PageCard>
    </>
  );
}

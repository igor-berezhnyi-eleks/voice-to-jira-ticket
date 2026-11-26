import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, Stack, TextField, Typography } from '@eleks-ui/components';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DownloadIcon from '@mui/icons-material/Download';
import MicIcon from '@mui/icons-material/Mic';
import ReplayIcon from '@mui/icons-material/Replay';
import StopIcon from '@mui/icons-material/Stop';
import TranslateIcon from '@mui/icons-material/Translate';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { generateTicket, translateText, type GenerateTicketResponse } from '../api';
import { describeGenerationError, describeTranslationError } from '../errorMessages';
import { useLanguage, useT } from '../i18n/LanguageProvider';
import { languages } from '../i18n/languages';
import { PageCard } from '../layout/AppShell';
import type { PageNavigation } from '../layout/PageHeader';
import { acceptedExtensions } from '../recording/audioFile';
import { appendTranscript, formatElapsed, maxRecordingSeconds, noSpeechNotice } from '../recording/recorderReducer';
import { useRecorder } from '../recording/useRecorder';
import { looksCyrillic } from './textLanguage';

// The API's lower limit (plan 4.4). It counts raw characters, as the API does.
export const minTranscriptLength = 20;
// The API's upper limit (GenerateTicketRequest.MaxTranscriptLength). Only the hint uses it; the API still decides.
const maxTranscriptLength = 20_000;

interface ReportPageProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  /**
   * A ticket was generated: by Generate (`next` = 'ticket', show Page 2) or by Go to Jira (`next` = 'jira', open Page 3
   * with it). The page stays busy until a returned promise settles.
   */
  onGenerated: (response: GenerateTicketResponse, next: GenerateNext) => void | Promise<void>;
  /** Jira is set up on the server: Go to Jira may be used. */
  jiraEnabled?: boolean;
  /** Receives the header steps after every render: Review = Generate, Jira = Go to Jira. */
  onNavigation?: (navigation: PageNavigation) => void;
}

/** Where the generated ticket goes: Page 2 (Generate) or straight to Page 3 (Go to Jira, decision N3). */
export type GenerateNext = 'ticket' | 'jira';

export function ReportPage({
  transcript,
  onTranscriptChange,
  onGenerated,
  jiraEnabled = false,
  onNavigation,
}: ReportPageProps) {
  const [running, setRunning] = useState(false);
  // The failure itself is kept, so its message is written in the language active when it is shown. `next` is the
  // button that failed: Retry repeats it, under that button's rules.
  const [failure, setFailure] = useState<{ error: unknown; next: GenerateNext } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationFailure, setTranslationFailure] = useState<{ error: unknown } | null>(null);
  // What the last translation did. `translated` is the text it put in the box: Undo is offered only while the box
  // still holds exactly that text, so an edit, a dictated part or a new text from elsewhere removes it.
  const [translation, setTranslation] = useState<
    { kind: 'translated'; original: string; translated: string; from: string } | { kind: 'unchanged'; to: string } | null
  >(null);
  const t = useT();
  const { language } = useLanguage();
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
  const busy = running || translating || recordingBusy;
  const generateDisabled = busy || transcript.length < minTranscriptLength;
  const translateDisabled = busy || transcript.length === 0;
  // Go to Jira generates first (N3), so it follows Generate's rules and also needs Jira.
  const jiraDisabled = generateDisabled || !jiraEnabled;
  const translationError = translationFailure ? describeTranslationError(translationFailure.error, t) : null;
  const undoable = translation?.kind === 'translated' && translation.translated === transcript ? translation : null;
  const nameOf = (code: string) => t.languageNames[code] ?? code;
  // One button, towards the other side: Cyrillic text goes to English, anything else to the selected language
  // (English when that is English, as the API translates to or from English only).
  const selected = languages.find(({ code }) => code === language);
  const target =
    looksCyrillic(transcript) || !selected || selected.code === 'en'
      ? { code: 'en', label: t.translateToEnglish }
      : { code: selected.code, label: t.translateTo(selected.name) };

  useEffect(() => () => request.current?.abort(), []);

  // The header's steps do what the buttons do, and are disabled exactly when the buttons are.
  const busyReason = busy ? t.stepReasons.busy : undefined;
  const steps = [
    { disabled: false },
    { disabled: generateDisabled, reason: busyReason ?? t.stepReasons.textTooShort(minTranscriptLength) },
    {
      disabled: jiraDisabled,
      reason: !jiraEnabled ? t.ticketPage.jiraNotConfigured : (busyReason ?? t.stepReasons.textTooShort(minTranscriptLength)),
    },
  ];
  // A layout effect, so the handler is in place in the same commit that shows the page (no click hits the old one).
  useLayoutEffect(() => {
    onNavigation?.({
      steps,
      go: (step) => {
        if (step === 1 && !generateDisabled) void generate('ticket');
        if (step === 2 && !jiraDisabled) void generate('jira');
      },
    });
  });

  async function translate(to: string) {
    const controller = new AbortController();
    request.current = controller;
    const original = transcript;
    setTranslating(true);
    setTranslationFailure(null);
    setTranslation(null);
    try {
      const result = await translateText(original, to, controller.signal);
      if (result.from === to) {
        setTranslation({ kind: 'unchanged', to });
      } else {
        onTranscriptChange(result.text);
        setTranslation({ kind: 'translated', original, translated: result.text, from: result.from });
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setTranslationFailure({ error: caught });
    } finally {
      setTranslating(false);
    }
  }

  /** Generate and Go to Jira send the same request; only where the ticket goes differs. */
  async function generate(next: GenerateNext) {
    const controller = new AbortController();
    request.current = controller;
    setRunning(true);
    setFailure(null);
    try {
      const response = await generateTicket(transcript, controller.signal);
      await onGenerated(response, next);
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setFailure({ error: caught, next });
    } finally {
      // An aborted request may finish after the next one started; only the latest one ends "running".
      if (request.current === controller) setRunning(false);
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
            disabled={running || translating || status === 'transcribing'}
            onClick={recorder.toggle}
          >
            {recordingActive ? t.stop : t.record}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={running || translating || recordingBusy}
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
            <Button variant="outlined" startIcon={<ReplayIcon />} disabled={running || translating} onClick={recorder.retry}>
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
          onChange={(event) => {
            setTranslation(null);
            onTranscriptChange(event.target.value);
          }}
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
            <Button
              variant="outlined"
              startIcon={<TranslateIcon />}
              disabled={translateDisabled}
              onClick={() => translate(target.code)}
            >
              {target.label}
            </Button>
          </Stack>
        </Stack>
        {translating && (
          <Typography variant="body2" role="status" sx={{ mt: 1 }}>
            {t.translating}
          </Typography>
        )}
        {undoable && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" role="status">
              {t.translatedFrom(nameOf(undoable.from))}
            </Typography>
            <Button
              variant="text"
              size="small"
              disabled={busy}
              onClick={() => {
                onTranscriptChange(undoable.original);
                setTranslation(null);
              }}
            >
              {t.undo}
            </Button>
          </Stack>
        )}
        {translation?.kind === 'unchanged' && (
          <Alert severity="info" role="status" sx={{ mt: 1 }}>
            {t.alreadyIn(nameOf(translation.to))}
          </Alert>
        )}
        {translationError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {translationError}
          </Alert>
        )}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          {running && (
            <Typography variant="body2" role="status">
              {t.generating}
            </Typography>
          )}
          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            disabled={jiraDisabled}
            title={jiraEnabled ? undefined : t.ticketPage.jiraNotConfigured}
            onClick={() => void generate('jira')}
          >
            {t.goToJira}
          </Button>
          <Button variant="contained" endIcon={<ArrowForwardIcon />} disabled={generateDisabled} onClick={() => void generate('ticket')}>
            {t.generateTicket}
          </Button>
        </Stack>
        {error && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
            <Alert severity="error" sx={{ flexGrow: 1 }}>
              {error.message}
            </Alert>
            {error.retryable && (
              <Button
                variant="outlined"
                disabled={failure?.next === 'jira' ? jiraDisabled : generateDisabled}
                onClick={() => void generate(failure?.next ?? 'ticket')}
              >
                {t.retry}
              </Button>
            )}
          </Stack>
        )}
      </PageCard>
    </>
  );
}

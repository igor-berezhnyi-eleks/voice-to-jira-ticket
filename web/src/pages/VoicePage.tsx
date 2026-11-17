import { useEffect, useRef, useState } from 'react'
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@eleks-ui/components'
import { translateText } from '../api/tickets'
import { downloadBlob, encodeMp3, recordingFileName } from '../audio/mp3'
import { isRecordingSupported, SAMPLE_RATE, startRecording, type Recorder, type Recording } from '../audio/recorder'
import { isModelCached, LANGUAGE_CODES, LANGUAGES, type Language } from '../stt/languages'
import { useSpeechToText, type SttState } from '../stt/useSpeechToText'

const supported = isRecordingSupported()

export function VoicePage(props: {
  transcript: string
  onTranscriptChange: (transcript: string) => void
  onGenerate: () => void
  generating: boolean
  error: string | null
}) {
  const { transcript, onTranscriptChange: setTranscript } = props
  const [recording, setRecording] = useState<Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const [speechLanguage, setSpeechLanguage] = useState<Language>('en')
  const [targetLanguage, setTargetLanguage] = useState<Language>('en')
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const { state, transcribe } = useSpeechToText(speechLanguage, setTranscript)

  // English is the default and loads on start. Any other language downloads its own model, so ask first
  // unless it is already cached.
  async function selectSpeechLanguage(language: Language) {
    if (language !== 'en' && !(await isModelCached(language))) {
      const { label, downloadSize } = LANGUAGES[language]
      const proceed = window.confirm(
        `The ${label} speech model is not downloaded yet. It is ${downloadSize ?? 'a large download'} (downloaded once, then cached in this browser).

Download it and use ${label}?`,
      )
      if (!proceed) {
        return
      }
    }
    setSpeechLanguage(language)
  }

  async function translate() {
    setTranslating(true)
    setTranslateError(null)
    try {
      setTranscript(await translateText(transcript, targetLanguage))
    } catch (failure) {
      setTranslateError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setTranslating(false)
    }
  }

  const busy = isRecording || state.phase === 'transcribing' || translating
  const translateSection = (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <LanguageSelect label="Translate to" value={targetLanguage} onChange={setTargetLanguage} disabled={busy} />
        <Button variant="outlined" onClick={translate} disabled={busy || transcript.trim().length === 0}>
          {translating ? 'Translating...' : 'Translate'}
        </Button>
      </Stack>
      {translateError && <Alert severity="error">{translateError}</Alert>}
    </>
  )

  const generateSection = (
    <GenerateSection
      canGenerate={transcript.trim().length > 0 && !busy}
      generating={props.generating}
      error={props.error}
      onGenerate={props.onGenerate}
    />
  )

  useEffect(() => {
    if (!isRecording) {
      return
    }
    const started = performance.now()
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 250)
    return () => clearInterval(timer)
  }, [isRecording])

  async function start() {
    setMicError(null)
    try {
      recorderRef.current = await startRecording()
      setElapsed(0)
      setIsRecording(true)
    } catch (error) {
      setMicError(describeMicError(error))
    }
  }

  async function stop() {
    const recorder = recorderRef.current
    recorderRef.current = null
    setIsRecording(false)
    if (!recorder) {
      return
    }
    const result = await recorder.stop()
    setRecording(result)
    if (result.samples.length > 0) {
      transcribe(result.samples)
    }
  }

  function saveAudio() {
    if (recording) {
      downloadBlob(encodeMp3(recording.samples), recordingFileName(recording.startedAt))
    }
  }

  if (!supported) {
    return (
      <Stack component="section" spacing={2}>
        <Typography variant="h5" component="h2">
          Describe the bug or feature
        </Typography>
        <Alert severity="error">
          Voice recording is not supported here. Use a current Chrome or Edge over HTTPS or localhost. You can
          still type or paste the report below.
        </Alert>
        <TranscriptField value={transcript} onChange={setTranscript} readOnly={translating} />
        {translateSection}
        {generateSection}
      </Stack>
    )
  }

  const transcribing = state.phase === 'transcribing'

  return (
    <Stack component="section" spacing={2}>
      <Typography variant="h5" component="h2">
        Describe the bug or feature
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Pick the language you speak. Audio stays in this browser; only the text below is used later. To file the
        ticket in another language, translate the text first.
      </Typography>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <LanguageSelect label="Speech language" value={speechLanguage} onChange={selectSpeechLanguage} disabled={busy} />
        {isRecording ? (
          <Button variant="contained" color="error" onClick={stop}>
            Stop ({formatSeconds(elapsed)})
          </Button>
        ) : (
          <Button variant="contained" onClick={start} disabled={transcribing}>
            Record
          </Button>
        )}
        <Button variant="outlined" onClick={saveAudio} disabled={!recording || isRecording}>
          Save audio
        </Button>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {statusText(state)}
        </Typography>
      </Stack>

      {micError && <Alert severity="error">{micError}</Alert>}
      {state.phase === 'error' && <Alert severity="error">{state.message}</Alert>}

      <TranscriptField value={transcript} onChange={setTranscript} readOnly={transcribing || translating} />
      {recording && (
        <Typography variant="body2" color="text.secondary">
          Last recording: {formatSeconds(Math.round(recording.samples.length / SAMPLE_RATE))}
        </Typography>
      )}
      {translateSection}
      {generateSection}
    </Stack>
  )
}

function LanguageSelect(props: {
  label: string
  value: Language
  onChange: (language: Language) => void | Promise<void>
  disabled: boolean
}) {
  return (
    <TextField
      select
      size="small"
      label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value as Language)}
      disabled={props.disabled}
      sx={{ minWidth: 160 }}
    >
      {LANGUAGE_CODES.map((code) => (
        <MenuItem key={code} value={code}>
          {LANGUAGES[code].label}
        </MenuItem>
      ))}
    </TextField>
  )
}

function GenerateSection(props: {
  canGenerate: boolean
  generating: boolean
  error: string | null
  onGenerate: () => void
}) {
  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={props.onGenerate} disabled={!props.canGenerate || props.generating}>
          {props.generating ? 'Generating...' : 'Generate ticket'}
        </Button>
      </Stack>
      {props.error && <Alert severity="error">{props.error}</Alert>}
    </>
  )
}

function TranscriptField(props: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  return (
    <TextField
      label="Transcript (editable)"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      multiline
      minRows={14}
      fullWidth
      placeholder="Record, or type / paste the report here."
      slotProps={{ input: { readOnly: props.readOnly } }}
    />
  )
}

function statusText(state: SttState): string {
  switch (state.phase) {
    case 'loading':
      return state.progress === null
        ? 'Loading speech model...'
        : `Downloading speech model: ${Math.round(state.progress)}%`
    case 'ready':
      return `Speech model ready (${state.device === 'webgpu' ? 'WebGPU' : 'CPU / WASM'})`
    case 'transcribing':
      return state.windows === 0 ? 'Transcribing...' : `Transcribing: part ${state.window} of ${state.windows}`
    case 'error':
      return 'Speech-to-text unavailable'
  }
}

function describeMicError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access was denied. Allow it in the browser address bar and try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone was found.'
    }
  }
  return `Could not start recording: ${error instanceof Error ? error.message : String(error)}`
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

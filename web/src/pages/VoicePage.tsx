import { useEffect, useRef, useState } from 'react'
import { downloadBlob, encodeMp3, recordingFileName } from '../audio/mp3'
import { isRecordingSupported, SAMPLE_RATE, startRecording, type Recorder, type Recording } from '../audio/recorder'
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
  const { state, transcribe } = useSpeechToText(setTranscript)

  const generateSection = (
    <GenerateSection
      canGenerate={transcript.trim().length > 0 && !isRecording && state.phase !== 'transcribing'}
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
      <section>
        <h2>Describe the bug or feature</h2>
        <p role="alert" className="error">
          Voice recording is not supported here. Use a current Chrome or Edge over HTTPS or localhost. You can
          still type or paste the report below.
        </p>
        <TranscriptField value={transcript} onChange={setTranscript} />
        {generateSection}
      </section>
    )
  }

  const transcribing = state.phase === 'transcribing'

  return (
    <section>
      <h2>Describe the bug or feature</h2>
      <p className="hint">Speak in English. Audio stays in this browser; only the text below is used later.</p>

      <div className="toolbar">
        {isRecording ? (
          <button type="button" onClick={stop}>
            Stop ({formatSeconds(elapsed)})
          </button>
        ) : (
          <button type="button" onClick={start} disabled={transcribing}>
            Record
          </button>
        )}
        <button type="button" onClick={saveAudio} disabled={!recording || isRecording}>
          Save audio
        </button>
        <span className="status" aria-live="polite">
          {statusText(state)}
        </span>
      </div>

      {micError && (
        <p role="alert" className="error">
          {micError}
        </p>
      )}
      {state.phase === 'error' && (
        <p role="alert" className="error">
          {state.message}
        </p>
      )}

      <TranscriptField value={transcript} onChange={setTranscript} readOnly={transcribing} />
      {recording && (
        <p className="hint">Last recording: {formatSeconds(Math.round(recording.samples.length / SAMPLE_RATE))}</p>
      )}
      {generateSection}
    </section>
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
      <div className="toolbar generate">
        <button type="button" onClick={props.onGenerate} disabled={!props.canGenerate || props.generating}>
          {props.generating ? 'Generating...' : 'Generate ticket'}
        </button>
      </div>
      {props.error && (
        <p role="alert" className="error">
          {props.error}
        </p>
      )}
    </>
  )
}

function TranscriptField(props: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  return (
    <label className="transcript">
      Transcript (editable)
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.readOnly}
        rows={14}
        placeholder="Record, or type / paste the report here."
      />
    </label>
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

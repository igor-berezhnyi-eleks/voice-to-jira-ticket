import { useCallback, useEffect, useRef, useState } from 'react'
import type { Device, WorkerRequest, WorkerResponse } from './messages'

export type SttState =
  | { phase: 'loading'; progress: number | null }
  | { phase: 'ready'; device: Device }
  | { phase: 'transcribing'; window: number; windows: number }
  | { phase: 'error'; message: string }

// Owns the speech-to-text Web Worker. The model starts downloading as soon as the page opens,
// so it is usually ready by the time the first recording stops.
export function useSpeechToText(onText: (text: string) => void) {
  const workerRef = useRef<Worker | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const onTextRef = useRef(onText)
  const [state, setState] = useState<SttState>({ phase: 'loading', progress: null })

  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  useEffect(() => {
    const worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      switch (message.type) {
        case 'loading':
          setState({ phase: 'loading', progress: message.progress })
          break
        case 'ready':
          deviceRef.current = message.device
          setState({ phase: 'ready', device: message.device })
          break
        case 'partial':
          onTextRef.current(message.text)
          setState({ phase: 'transcribing', window: message.window, windows: message.windows })
          break
        case 'done':
          onTextRef.current(message.text)
          setState({ phase: 'ready', device: deviceRef.current ?? 'wasm' })
          break
        case 'error':
          setState({ phase: 'error', message: message.message })
          break
      }
    }
    worker.onerror = (event) => setState({ phase: 'error', message: `Speech-to-text worker failed: ${event.message}` })
    worker.postMessage({ type: 'load' } satisfies WorkerRequest)
    return () => worker.terminate()
  }, [])

  const transcribe = useCallback((audio: Float32Array) => {
    setState({ phase: 'transcribing', window: 0, windows: 0 })
    // Copy so the caller keeps its buffer (needed for Save audio); the copy is transferred.
    const copy = audio.slice()
    workerRef.current?.postMessage({ type: 'transcribe', audio: copy } satisfies WorkerRequest, [copy.buffer])
  }, [])

  return { state, transcribe }
}

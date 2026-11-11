import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers'
import { SAMPLE_RATE } from '../audio/recorder'
import type { Device, WorkerRequest, WorkerResponse } from './messages'
import { splitIntoWindows } from './windows'

// English-only (.en) Whisper. The model is English by construction, so no language option is
// passed (Transformers.js rejects `language` for English-only models).
const MODEL = import.meta.env.VITE_STT_MODEL || 'onnx-community/whisper-small.en'

// WebGPU: full-precision encoder (quantised encoders lose accuracy) and a 4-bit decoder.
// WASM: 8-bit weights for both, which is what runs fast enough on CPU.
const DTYPES = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: { encoder_model: 'q8', decoder_model_merged: 'q8' },
} as const

let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function post(message: WorkerResponse) {
  self.postMessage(message)
}

function onProgress(info: ProgressInfo) {
  if (info.status === 'progress_total') {
    post({ type: 'loading', progress: info.progress })
  }
}

async function create(device: Device) {
  const asr = await pipeline('automatic-speech-recognition', MODEL, {
    device,
    dtype: DTYPES[device],
    progress_callback: onProgress,
  })
  post({ type: 'ready', device })
  return asr as AutomaticSpeechRecognitionPipeline
}

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  try {
    return (await gpu?.requestAdapter()) != null
  } catch {
    return false
  }
}

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  post({ type: 'loading', progress: null })
  if (await hasWebGpu()) {
    try {
      return await create('webgpu')
    } catch (error) {
      console.warn('WebGPU model load failed, falling back to WASM.', error)
    }
  }
  return create('wasm')
}

function getTranscriber() {
  transcriber ??= load().catch((error: unknown) => {
    transcriber = null
    throw error
  })
  return transcriber
}

async function transcribe(audio: Float32Array) {
  const asr = await getTranscriber()
  const windows = splitIntoWindows(audio, SAMPLE_RATE)
  const parts: string[] = []
  for (let i = 0; i < windows.length; i++) {
    const output = await asr(windows[i])
    parts.push(output.text.trim())
    post({ type: 'partial', text: parts.filter(Boolean).join(' '), window: i + 1, windows: windows.length })
  }
  post({ type: 'done', text: parts.filter(Boolean).join(' ') })
}

function describe(error: unknown, action: string): string {
  const detail = error instanceof Error ? error.message : String(error)
  if (/fetch|network/i.test(detail)) {
    return `Could not download the speech model (${detail}). Check the network connection and try again.`
  }
  if (/memory|allocation/i.test(detail)) {
    return `Not enough memory to ${action}. Try a smaller model (VITE_STT_MODEL) or close other tabs.`
  }
  return `Failed to ${action}: ${detail}`
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'load') {
      await getTranscriber()
    } else {
      await transcribe(request.audio)
    }
  } catch (error) {
    post({ type: 'error', message: describe(error, request.type === 'load' ? 'load the speech model' : 'transcribe') })
  }
}

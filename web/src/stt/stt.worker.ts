import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers'
import { SAMPLE_RATE } from '../audio/recorder'
import type { Device, WorkerRequest, WorkerResponse } from './messages'
import { LANGUAGES, type Language } from './languages'
import { splitIntoWindows } from './windows'

// WebGPU: full-precision encoder (quantised encoders lose accuracy) and a 4-bit decoder.
// WASM: 8-bit weights for both, which is what runs fast enough on CPU.
const DTYPES = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: { encoder_model: 'q8', decoder_model_merged: 'q8' },
} as const

// Loaded models stay in memory, so switching back to a language never re-fetches or re-initialises it
// (the browser Cache API can be unavailable, e.g. on an untrusted HTTPS certificate, which forces a re-download).
const loaded = new Map<Language, Promise<AutomaticSpeechRecognitionPipeline>>()

function post(message: WorkerResponse) {
  self.postMessage(message)
}

function onProgress(info: ProgressInfo) {
  if (info.status === 'progress_total') {
    post({ type: 'loading', progress: info.progress })
  }
}

async function create(language: Language, device: Device) {
  const asr = await pipeline('automatic-speech-recognition', LANGUAGES[language].model, {
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

async function load(language: Language): Promise<AutomaticSpeechRecognitionPipeline> {
  post({ type: 'loading', progress: null })
  if (await hasWebGpu()) {
    try {
      return await create(language, 'webgpu')
    } catch (error) {
      console.warn('WebGPU model load failed, falling back to WASM.', error)
    }
  }
  return create(language, 'wasm')
}

function getTranscriber(language: Language) {
  let entry = loaded.get(language)
  if (!entry) {
    entry = load(language).catch((error: unknown) => {
      loaded.delete(language)
      throw error
    })
    loaded.set(language, entry)
  }
  return entry
}

async function transcribe(language: Language, audio: Float32Array) {
  const asr = await getTranscriber(language)
  const options = LANGUAGES[language].whisperName
    ? { language: LANGUAGES[language].whisperName, task: 'transcribe' }
    : {}
  const windows = splitIntoWindows(audio, SAMPLE_RATE)
  const parts: string[] = []
  for (let i = 0; i < windows.length; i++) {
    const output = await asr(windows[i], options)
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
      await getTranscriber(request.language)
    } else {
      await transcribe(request.language, request.audio)
    }
  } catch (error) {
    post({ type: 'error', message: describe(error, request.type === 'load' ? 'load the speech model' : 'transcribe') })
  }
}

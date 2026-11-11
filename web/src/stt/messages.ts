export type Device = 'webgpu' | 'wasm'

export type WorkerRequest = { type: 'load' } | { type: 'transcribe'; audio: Float32Array }

export type WorkerResponse =
  | { type: 'loading'; progress: number | null }
  | { type: 'ready'; device: Device }
  | { type: 'partial'; text: string; window: number; windows: number }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string }

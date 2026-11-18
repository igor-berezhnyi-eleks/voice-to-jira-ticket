import workletUrl from './pcm-worklet.ts?worker&url'

export const SAMPLE_RATE = 16_000

export type Recording = {
  samples: Float32Array
  startedAt: Date
}

export type Recorder = {
  stop: () => Promise<Recording>
}

export function isRecordingSupported(): boolean {
  return (
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.AudioWorkletNode === 'function' &&
    typeof window.Worker === 'function'
  )
}

// Records mono 16 kHz float32 PCM into memory. Nothing leaves the browser.
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
  const context = new AudioContext({ sampleRate: SAMPLE_RATE })
  try {
    await context.audioWorklet.addModule(workletUrl)
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    await context.close()
    throw error
  }

  const source = context.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(context, 'pcm-collector')
  const chunks: Float32Array[] = []
  const startedAt = new Date()

  node.port.onmessage = (event: MessageEvent<Float32Array>) => chunks.push(event.data)
  source.connect(node)

  return {
    stop: () =>
      new Promise<Recording>((resolve) => {
        stream.getTracks().forEach((track) => track.stop())
        source.disconnect()
        // The worklet answers the flush with its last partial batch, which is the final chunk.
        node.port.onmessage = (event: MessageEvent<Float32Array>) => {
          chunks.push(event.data)
          node.port.onmessage = null
          void context.close()
          resolve({ samples: concat(chunks), startedAt })
        }
        node.port.postMessage('flush')
      }),
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  const result = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

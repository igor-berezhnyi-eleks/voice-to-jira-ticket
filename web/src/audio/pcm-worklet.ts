// Runs on the audio rendering thread. Downmixes every input block to mono and posts
// batches of samples to the main thread. The AudioContext is created at 16 kHz, so the
// browser has already resampled the microphone signal before it reaches this processor.

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void

const BATCH_SIZE = 4096

class PcmCollector extends AudioWorkletProcessor {
  private batch = new Float32Array(BATCH_SIZE)
  private filled = 0

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<string>) => {
      if (event.data === 'flush') {
        this.port.postMessage(this.batch.slice(0, this.filled))
        this.filled = 0
      }
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0]
    if (!channels || channels.length === 0) {
      return true
    }

    const frames = channels[0].length
    for (let i = 0; i < frames; i++) {
      let sum = 0
      for (const channel of channels) {
        sum += channel[i]
      }
      this.batch[this.filled++] = sum / channels.length
      if (this.filled === BATCH_SIZE) {
        this.port.postMessage(this.batch.slice())
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-collector', PcmCollector)

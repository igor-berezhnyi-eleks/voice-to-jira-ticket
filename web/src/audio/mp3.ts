import { Mp3Encoder } from '@breezystack/lamejs'
import { SAMPLE_RATE } from './recorder'

const KBPS = 64
const FRAME = 1152

export function encodeMp3(samples: Float32Array): Blob {
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, KBPS)
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const parts: Uint8Array<ArrayBuffer>[] = []
  for (let i = 0; i < pcm.length; i += FRAME) {
    parts.push(new Uint8Array(encoder.encodeBuffer(pcm.subarray(i, i + FRAME))))
  }
  parts.push(new Uint8Array(encoder.flush()))
  return new Blob(parts, { type: 'audio/mpeg' })
}

// yyyyMMdd_HHmmss_record.mp3, in local time of the recording start.
export function recordingFileName(startedAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${startedAt.getFullYear()}${pad(startedAt.getMonth() + 1)}${pad(startedAt.getDate())}`
  const time = `${pad(startedAt.getHours())}${pad(startedAt.getMinutes())}${pad(startedAt.getSeconds())}`
  return `${date}_${time}_record.mp3`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

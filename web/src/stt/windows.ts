// Splits audio into windows of at most `maxSeconds` (Whisper's 30 s context) so each can be
// transcribed on its own and reported as progress. A window ends at the quietest 100 ms frame
// in its last `searchSeconds`, so cuts fall between words and no overlap merging is needed.
export function splitIntoWindows(
  audio: Float32Array,
  sampleRate: number,
  maxSeconds = 30,
  searchSeconds = 5,
): Float32Array[] {
  const maxLength = maxSeconds * sampleRate
  const frame = sampleRate / 10
  const windows: Float32Array[] = []

  let start = 0
  while (audio.length - start > maxLength) {
    const searchFrom = start + maxLength - searchSeconds * sampleRate
    let cut = start + maxLength
    let quietest = Number.POSITIVE_INFINITY
    for (let frameStart = searchFrom; frameStart + frame <= start + maxLength; frameStart += frame) {
      let energy = 0
      for (let i = frameStart; i < frameStart + frame; i++) {
        energy += audio[i] * audio[i]
      }
      if (energy < quietest) {
        quietest = energy
        cut = frameStart + frame / 2
      }
    }
    windows.push(audio.subarray(start, cut))
    start = cut
  }
  if (audio.length > start) {
    windows.push(audio.subarray(start))
  }
  return windows
}

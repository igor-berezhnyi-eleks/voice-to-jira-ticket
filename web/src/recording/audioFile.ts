import { maxRecordingSeconds } from './recorderReducer';

/** The API's limit (`TranscribeEndpoint.MaxAudioBytes`). */
export const maxAudioBytes = 25 * 1024 * 1024;

/** File extension → the content type the API accepts. The browser's own file type is not trusted. */
const typesByExtension: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
};

/** For the file picker's `accept` attribute. */
export const acceptedExtensions = Object.keys(typesByExtension).map((extension) => `.${extension}`);

export interface PreparedAudio {
  blob: Blob;
  fileName: string;
}

export type PreparedAudioResult = PreparedAudio | { message: string };

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** Checks the type and size of a chosen file and gives it the content type the API expects. */
export function prepareAudioFile(file: File): PreparedAudioResult {
  const type = typesByExtension[extensionOf(file.name)];
  if (type === undefined) {
    return { message: `That file type is not supported. Use ${acceptedExtensions.join(', ')}.` };
  }
  if (file.size === 0) {
    return { message: 'That file is empty.' };
  }
  if (file.size > maxAudioBytes) {
    return { message: 'That file is too large to transcribe (limit 25 MB).' };
  }
  return { blob: new Blob([file], { type }), fileName: file.name };
}

/** `null` when the length is within the recording limit or unknown; otherwise the message to show. */
export function durationMessage(seconds: number | null): string | null {
  if (seconds === null || seconds <= maxRecordingSeconds) {
    return null;
  }
  const minutes = Math.floor(Math.ceil(seconds) / 60);
  const rest = String(Math.ceil(seconds) % 60).padStart(2, '0');
  return `That recording is ${minutes}:${rest} long. The limit is 5:00. Use a shorter file.`;
}

const durationTimeoutMs = 10_000;

/**
 * Reads the length in seconds through an audio element, or `null` when the browser cannot tell.
 * Chrome reports `Infinity` for MediaRecorder `.webm` files (no duration header) until it seeks to the end.
 */
export function readAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const finish = (seconds: number | null) => {
      clearTimeout(timeout);
      audio.onloadedmetadata = null;
      audio.ondurationchange = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const timeout = setTimeout(() => finish(null), durationTimeoutMs);
    audio.preload = 'metadata';
    audio.onerror = () => finish(null);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        finish(audio.duration);
        return;
      }
      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration)) {
          finish(audio.duration);
        }
      };
      audio.currentTime = 1e101;
    };
    audio.src = url;
  });
}

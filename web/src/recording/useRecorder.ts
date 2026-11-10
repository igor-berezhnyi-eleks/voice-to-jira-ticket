import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError, transcribeAudio } from '../api';
import { initialRecorderState, maxRecordingSeconds, recorderReducer, type RecorderState } from './recorderReducer';

/** In order of preference. Only types the API accepts (webm, ogg, wav, mpeg); `audio/mp4` is never chosen. */
export const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];

const unsupportedMessage =
  'Recording is not supported in this browser. Use a current Chrome or Edge, or type the report instead.';

interface Recording {
  blob: Blob;
  fileName: string;
}

export interface UseRecorder {
  state: RecorderState;
  /** True once a recording exists that can be downloaded or re-sent. */
  hasRecording: boolean;
  /** True when the last failure was an upload, so the kept recording can be re-sent. */
  canRetry: boolean;
  /** Starts a recording; stops it when one is running or being set up. */
  toggle: () => void;
  /** Re-sends the kept recording after an upload error. */
  retry: () => void;
  download: () => void;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function timestamp(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function extensionFor(mimeType: string): string {
  return mimeType.startsWith('audio/ogg') ? 'ogg' : 'webm';
}

function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was denied. Allow the microphone for this site in the browser, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Connect one and try again.';
  }
  return 'The microphone could not be started. Check that no other app is using it, then try again.';
}

function transcriptionMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'stt_unavailable':
        return 'The transcription service is not available. Start it and use Try again, or download the recording.';
      case 'stt_timeout':
        return 'Transcription took too long. Use Try again, or download the recording.';
      case 'payload_too_large':
        return 'The recording is too large to transcribe (limit 25 MB). Download it and record a shorter report.';
      default:
        return error.message;
    }
  }
  return 'Something went wrong while transcribing. Use Try again, or download the recording.';
}

/**
 * Records the microphone with `MediaRecorder` and transcribes the result through the API.
 * `onText` receives each non-empty transcript; the caller decides where it goes.
 */
export function useRecorder(onText: (text: string) => void): UseRecorder {
  const [state, dispatch] = useReducer(recorderReducer, initialRecorderState);
  const [hasRecording, setHasRecording] = useState(false);
  // True only when the last failure was an upload, so "Try again" never re-sends an old recording after a microphone error.
  const [canRetry, setCanRetry] = useState(false);

  // The status as of the last dispatch, so two quick clicks cannot both start a recording.
  const status = useRef(state.status);
  const onTextRef = useRef(onText);
  const recording = useRef<Recording | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const attempt = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const send = useCallback((action: Parameters<typeof dispatch>[0]) => {
    if (unmounted.current) {
      return;
    }
    status.current = recorderReducer({ ...initialRecorderState, status: status.current }, action).status;
    dispatch(action);
  }, []);

  const releaseMicrophone = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const upload = useCallback(
    async (kept: Recording) => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const { text } = await transcribeAudio(kept.blob, kept.fileName, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        // On silence the model often answers with punctuation only (for example "."), which is not speech.
        const trimmed = /[\p{L}\p{N}]/u.test(text) ? text.trim() : '';
        if (trimmed !== '') {
          onTextRef.current(trimmed);
        }
        send({ type: 'transcribed', empty: trimmed === '' });
      } catch (failure) {
        if (controller.signal.aborted) {
          return;
        }
        setCanRetry(true);
        send({ type: 'failed', message: transcriptionMessage(failure) });
      }
    },
    [send],
  );

  const toggle = useCallback(() => {
    if (status.current === 'recording') {
      recorder.current?.stop(); // `onstop` finishes the job
      return;
    }
    if (status.current === 'requesting') {
      attempt.current += 1; // the pending microphone request is now stale
      send({ type: 'cancel' });
      return;
    }
    if (status.current !== 'idle' && status.current !== 'error') {
      return;
    }

    attempt.current += 1;
    const mine = attempt.current;
    setCanRetry(false);
    send({ type: 'start' });

    const mimeType =
      typeof MediaRecorder === 'undefined' ? undefined : preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (mimeType === undefined || !navigator.mediaDevices?.getUserMedia) {
      send({ type: 'failed', message: unsupportedMessage });
      return;
    }

    void (async () => {
      let microphone: MediaStream;
      try {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (failure) {
        if (attempt.current === mine) {
          send({ type: 'failed', message: microphoneMessage(failure) });
        }
        return;
      }
      if (attempt.current !== mine || unmounted.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }

      const chunks: Blob[] = [];
      let failed = false;
      const instance = new MediaRecorder(microphone, { mimeType });
      stream.current = microphone;
      recorder.current = instance;

      instance.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      instance.onerror = () => {
        failed = true;
        releaseMicrophone();
        send({ type: 'failed', message: 'The recording failed. Please try again.' });
      };
      instance.onstop = () => {
        releaseMicrophone();
        recorder.current = null;
        if (failed || unmounted.current) {
          return;
        }
        const type = instance.mimeType || mimeType;
        const kept = {
          blob: new Blob(chunks, { type }),
          fileName: `recording-${timestamp(new Date())}.${extensionFor(type)}`,
        };
        recording.current = kept;
        setHasRecording(true);
        send({ type: 'stopped' });
        void upload(kept);
      };

      instance.start();
      send({ type: 'started' });
      timer.current = setInterval(() => {
        send({ type: 'tick' });
      }, 1000);
    })();
  }, [releaseMicrophone, send, upload]);

  // The 5-minute limit stops the recording exactly like the Stop button.
  useEffect(() => {
    if (state.status === 'recording' && state.elapsedSeconds >= maxRecordingSeconds) {
      recorder.current?.stop();
    }
  }, [state.status, state.elapsedSeconds]);

  const retry = useCallback(() => {
    if (status.current !== 'error' || recording.current === null) {
      return;
    }
    setCanRetry(false);
    send({ type: 'retry' });
    void upload(recording.current);
  }, [send, upload]);

  const download = useCallback(() => {
    const kept = recording.current;
    if (kept === null) {
      return;
    }
    const url = URL.createObjectURL(kept.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = kept.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      request.current?.abort();
      const active = recorder.current;
      if (active !== null) {
        active.ondataavailable = null;
        active.onerror = null;
        active.onstop = null;
        if (active.state !== 'inactive') {
          active.stop();
        }
        recorder.current = null;
      }
      releaseMicrophone();
    };
  }, [releaseMicrophone]);

  return { state, hasRecording, canRetry, toggle, retry, download };
}

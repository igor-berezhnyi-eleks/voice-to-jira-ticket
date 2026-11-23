import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError, transcribeAudio } from '../api';
import { en, type Dictionary } from '../i18n/en';
import { useLanguage, useT } from '../i18n/LanguageProvider';
import { durationMessage, prepareAudioFile, readAudioDuration } from './audioFile';
import { initialRecorderState, maxRecordingSeconds, recorderReducer, type RecorderState } from './recorderReducer';

/** In order of preference. Only types the API accepts (webm, ogg, wav, mpeg); `audio/mp4` is never chosen. */
export const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];

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
  /** Checks a chosen audio file (type, size, length) and transcribes it like a recording. */
  uploadFile: (file: File) => void;
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

function microphoneMessage(error: unknown, t: Dictionary): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return t.microphoneDenied;
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return t.microphoneMissing;
  }
  return t.microphoneFailed;
}

function transcriptionMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'stt_unavailable':
        return t.sttUnavailable;
      case 'stt_timeout':
        return t.sttTimeout;
      case 'stt_busy':
        return t.sttBusy;
      case 'payload_too_large':
        return t.audioTooLargeToTranscribe;
      case 'audio_unreadable':
        return t.audioUnreadable;
      case 'network_error':
      case 'unexpected_response':
        return t.serverUnreachableRecording;
      default:
        return error.message;
    }
  }
  return t.transcriptionFailed;
}

/**
 * Records the microphone with `MediaRecorder` and transcribes the result through the API.
 * `onText` receives each non-empty transcript; the caller decides where it goes.
 */
export function useRecorder(onText: (text: string) => void): UseRecorder {
  const t = useT();
  const { language } = useLanguage();
  // Messages are written in the language active when they are raised; callbacks read the latest.
  const tRef = useRef<Dictionary>(en);
  // The spoken language is the one selected when the audio is sent.
  const languageRef = useRef<string>(language);
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
    tRef.current = t;
    languageRef.current = language;
  }, [onText, t, language]);

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
        const { text } = await transcribeAudio(kept.blob, kept.fileName, controller.signal, languageRef.current);
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
        // Re-sending a file the server cannot decode would fail the same way.
        setCanRetry(!(failure instanceof ApiError && failure.code === 'audio_unreadable'));
        send({ type: 'failed', message: transcriptionMessage(failure, tRef.current) });
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
      send({ type: 'failed', message: tRef.current.recordingUnsupported });
      return;
    }

    void (async () => {
      let microphone: MediaStream;
      try {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (failure) {
        if (attempt.current === mine) {
          send({ type: 'failed', message: microphoneMessage(failure, tRef.current) });
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
        send({ type: 'failed', message: tRef.current.recordingFailed });
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

  const uploadFile = useCallback(
    (file: File) => {
      if (status.current !== 'idle' && status.current !== 'error') {
        return;
      }
      setCanRetry(false);
      send({ type: 'upload' });
      void (async () => {
        const prepared = prepareAudioFile(file, tRef.current);
        if ('message' in prepared) {
          send({ type: 'failed', message: prepared.message });
          return;
        }
        const tooLong = durationMessage(await readAudioDuration(prepared.blob), tRef.current);
        if (unmounted.current) {
          return;
        }
        if (tooLong !== null) {
          send({ type: 'failed', message: tooLong });
          return;
        }
        recording.current = prepared;
        setHasRecording(true);
        void upload(prepared);
      })();
    },
    [send, upload],
  );

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

  return { state, hasRecording, canRetry, toggle, retry, uploadFile, download };
}

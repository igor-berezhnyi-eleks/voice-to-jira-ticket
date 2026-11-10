import { describe, expect, it } from 'vitest';
import {
  appendTranscript,
  formatElapsed,
  initialRecorderState,
  noSpeechNotice,
  recorderReducer,
  type RecorderAction,
  type RecorderState,
} from './recorderReducer';

function run(...actions: RecorderAction[]): RecorderState {
  return actions.reduce(recorderReducer, initialRecorderState);
}

describe('recorderReducer', () => {
  it('goes idle → requesting → recording → transcribing → idle', () => {
    expect(run({ type: 'start' }).status).toBe('requesting');
    expect(run({ type: 'start' }, { type: 'started' }).status).toBe('recording');
    expect(run({ type: 'start' }, { type: 'started' }, { type: 'stopped' }).status).toBe('transcribing');
    const done = run({ type: 'start' }, { type: 'started' }, { type: 'stopped' }, { type: 'transcribed', empty: false });
    expect(done).toEqual(initialRecorderState);
  });

  it('counts seconds only while recording and resets them for the next recording', () => {
    expect(run({ type: 'tick' }).elapsedSeconds).toBe(0);
    expect(run({ type: 'start' }, { type: 'tick' }).elapsedSeconds).toBe(0);
    const recording = run({ type: 'start' }, { type: 'started' }, { type: 'tick' }, { type: 'tick' });
    expect(recording.elapsedSeconds).toBe(2);
    expect(recorderReducer(recording, { type: 'tick' }).elapsedSeconds).toBe(3);
    expect(recorderReducer(recording, { type: 'stopped' })).toMatchObject({ status: 'transcribing', elapsedSeconds: 0 });
  });

  it('returns to idle when stopped while the microphone is still being requested', () => {
    expect(run({ type: 'start' }, { type: 'cancel' })).toEqual(initialRecorderState);
  });

  it('ignores a second start while busy', () => {
    const recording = run({ type: 'start' }, { type: 'started' }, { type: 'tick' });
    expect(recorderReducer(recording, { type: 'start' })).toBe(recording);
    const requesting = run({ type: 'start' });
    expect(recorderReducer(requesting, { type: 'start' })).toBe(requesting);
    const transcribing = run({ type: 'start' }, { type: 'started' }, { type: 'stopped' });
    expect(recorderReducer(transcribing, { type: 'start' })).toBe(transcribing);
  });

  it('ignores actions that do not fit the status', () => {
    expect(run({ type: 'started' })).toEqual(initialRecorderState);
    expect(run({ type: 'stopped' })).toEqual(initialRecorderState);
    expect(run({ type: 'retry' })).toEqual(initialRecorderState);
    expect(run({ type: 'transcribed', empty: false })).toEqual(initialRecorderState);
    expect(run({ type: 'failed', message: 'x' })).toEqual(initialRecorderState);
    const recording = run({ type: 'start' }, { type: 'started' });
    expect(recorderReducer(recording, { type: 'cancel' })).toBe(recording);
    expect(recorderReducer(recording, { type: 'transcribed', empty: true })).toBe(recording);
  });

  it('reports a failure from any busy status and keeps the message', () => {
    for (const steps of [
      [{ type: 'start' }],
      [{ type: 'start' }, { type: 'started' }],
      [{ type: 'start' }, { type: 'started' }, { type: 'stopped' }],
    ] satisfies RecorderAction[][]) {
      expect(run(...steps, { type: 'failed', message: 'boom' })).toMatchObject({ status: 'error', error: 'boom' });
    }
  });

  it('retries from error into transcribing and clears the error', () => {
    const failed = run({ type: 'start' }, { type: 'started' }, { type: 'stopped' }, { type: 'failed', message: 'down' });
    expect(recorderReducer(failed, { type: 'retry' })).toEqual({ ...initialRecorderState, status: 'transcribing' });
  });

  it('can start a new recording from error and clears the old error', () => {
    const failed = run({ type: 'start' }, { type: 'failed', message: 'denied' });
    expect(recorderReducer(failed, { type: 'start' })).toEqual({ ...initialRecorderState, status: 'requesting' });
  });

  it('sets the no-speech notice only for an empty transcript, and the next start clears it', () => {
    const base: RecorderAction[] = [{ type: 'start' }, { type: 'started' }, { type: 'stopped' }];
    const silent = run(...base, { type: 'transcribed', empty: true });
    expect(silent).toMatchObject({ status: 'idle', notice: noSpeechNotice, error: null });
    expect(recorderReducer(silent, { type: 'start' }).notice).toBeNull();
    expect(run(...base, { type: 'transcribed', empty: false }).notice).toBeNull();
  });
});

describe('appendTranscript', () => {
  it('returns the addition when the box is empty', () => {
    expect(appendTranscript('', 'hello')).toBe('hello');
  });

  it('separates with one space', () => {
    expect(appendTranscript('first part', 'second part')).toBe('first part second part');
  });

  it('adds no second separator after trailing whitespace or a newline', () => {
    expect(appendTranscript('first part ', 'second')).toBe('first part second');
    expect(appendTranscript('first part\n', 'second')).toBe('first part\nsecond');
  });

  it('leaves the text unchanged for an empty addition', () => {
    expect(appendTranscript('first part', '')).toBe('first part');
  });
});

describe('formatElapsed', () => {
  it('formats m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9)).toBe('0:09');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(300)).toBe('5:00');
  });
});

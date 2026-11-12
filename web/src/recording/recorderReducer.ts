/** Longest single recording (plan 4.8). Reaching it stops the recording as if the user pressed Stop. */
export const maxRecordingSeconds = 300;

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

export interface RecorderState {
  status: RecorderStatus;
  /** Whole seconds recorded so far; only meaningful while recording. */
  elapsedSeconds: number;
  /** Set when status is `error`. */
  error: string | null;
  /** A non-error message for the last finished recording, such as "no speech". */
  notice: string | null;
}

export type RecorderAction =
  | { type: 'start' }
  | { type: 'started' }
  | { type: 'cancel' }
  | { type: 'tick' }
  | { type: 'stopped' }
  | { type: 'retry' }
  | { type: 'upload' }
  | { type: 'transcribed'; empty: boolean }
  | { type: 'failed'; message: string };

export const initialRecorderState: RecorderState = { status: 'idle', elapsedSeconds: 0, error: null, notice: null };

export const noSpeechNotice = 'No speech was detected. Nothing was added to the transcript.';

/** Pure state machine for the recorder. Actions that do not fit the current status are ignored. */
export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case 'start':
      return state.status === 'idle' || state.status === 'error' ? { ...initialRecorderState, status: 'requesting' } : state;
    case 'started':
      return state.status === 'requesting' ? { ...initialRecorderState, status: 'recording' } : state;
    case 'cancel':
      return state.status === 'requesting' ? initialRecorderState : state;
    case 'tick':
      return state.status === 'recording' ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 } : state;
    case 'stopped':
      return state.status === 'recording' ? { ...initialRecorderState, status: 'transcribing' } : state;
    case 'retry':
      return state.status === 'error' ? { ...initialRecorderState, status: 'transcribing' } : state;
    case 'upload':
      return state.status === 'idle' || state.status === 'error' ? { ...initialRecorderState, status: 'transcribing' } : state;
    case 'transcribed':
      return state.status === 'transcribing'
        ? { ...initialRecorderState, notice: action.empty ? noSpeechNotice : null }
        : state;
    case 'failed':
      return state.status === 'idle' ? state : { ...initialRecorderState, status: 'error', error: action.message };
  }
}

/** Adds dictated text after what is already there, separated by one space unless the text already ends in whitespace. */
export function appendTranscript(existing: string, addition: string): string {
  if (addition === '') {
    return existing;
  }
  if (existing === '' || /\s$/.test(existing)) {
    return existing + addition;
  }
  return `${existing} ${addition}`;
}

/** `m:ss` */
export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

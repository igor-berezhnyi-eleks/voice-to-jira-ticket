import { plural } from './plural';

/**
 * The source dictionary. Its type is the contract for every other language (`uk.ts` is typed against it),
 * so a missing key fails `npm run build`. Entries are strings or functions (values, plurals).
 */
export const en = {
  locale: 'en',

  // Header
  appName: 'Voice to Ticket',
  steps: ['Report', 'Review', 'Jira'],
  progress: 'Progress',
  languageSelector: 'Interface language',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',

  // Page 1
  reportTitle: 'Describe the bug or feature',
  reportHint:
    'Record or upload a spoken report (English; .wav, .mp3, .webm or .ogg, up to 5 minutes and 25 MB), or type it below. Record or upload more to append more text to the transcript. Check the text, then generate the ticket.',
  record: 'Record',
  stop: 'Stop',
  uploadRecording: 'Upload recording',
  audioFile: 'Audio file',
  recordingTimer: (elapsed: string, max: string) => `Recording ${elapsed} / ${max}`,
  waitingForMicrophone: 'Waiting for the microphone…',
  transcribing: 'Transcribing…',
  tryAgain: 'Try again',
  downloadRecording: 'Download recording',
  transcript: 'Transcript',
  charactersNeeded: (count: number, min: number) =>
    `${count} ${plural('en', count, { one: 'character', other: 'characters' })}, at least ${min} needed`,
  charactersOverLimit: (count: number, limit: number) =>
    `${count} ${plural('en', count, { one: 'character', other: 'characters' })}, over the ${limit.toLocaleString('en-US')}-character limit`,
  language: 'Language',
  translate: 'Translate',
  generating: 'Generating…',
  generateTicket: 'Generate ticket',
  retry: 'Retry',
  fakeBanner: 'Fake generator active — tickets are not real',

  // Recorder messages
  noSpeech: 'No speech was detected. Nothing was added to the transcript.',
  recordingUnsupported: 'Recording is not supported in this browser. Use a current Chrome or Edge, or type the report instead.',
  recordingFailed: 'The recording failed. Please try again.',
  microphoneDenied: 'Microphone access was denied. Allow the microphone for this site in the browser, then try again.',
  microphoneMissing: 'No microphone was found. Connect one and try again.',
  microphoneFailed: 'The microphone could not be started. Check that no other app is using it, then try again.',
  sttUnavailable: 'The transcription service is not available. Start it and use Try again, or download the recording.',
  sttTimeout: 'Transcription took too long. Use Try again, or download the recording.',
  audioTooLargeToTranscribe: 'The recording is too large to transcribe (limit 25 MB). Download it and record a shorter report.',
  audioUnreadable: 'The audio could not be read. Use a valid .wav, .mp3, .webm or .ogg file.',
  serverUnreachableRecording: 'Could not reach the server. Start it, then use Try again, or download the recording.',
  transcriptionFailed: 'Something went wrong while transcribing. Use Try again, or download the recording.',

  // Upload checks
  fileTypeNotSupported: (accepted: string) => `That file type is not supported. Use ${accepted}.`,
  fileEmpty: 'That file is empty.',
  fileTooLarge: 'That file is too large to transcribe (limit 25 MB).',
  recordingTooLong: (length: string) => `That recording is ${length} long. The limit is 5:00. Use a shorter file.`,

  // Generation errors
  genericError: 'Something went wrong. Please try again.',
  errors: {
    llm_refused: 'The ticket service declined to process this report. Edit the transcript, then press Generate ticket.',
    llm_invalid_output:
      'The ticket service returned a ticket that could not be used. Try again; if it keeps happening, reword the report.',
    llm_truncated:
      'The ticket was cut off because the report is too long to process in one go. Try again, or use a shorter report.',
    llm_unavailable:
      'The ticket service is not available right now. Try again in a moment; if it persists, ask whoever runs this tool to check its setup.',
    llm_timeout: 'The ticket service took too long to answer. Try again.',
    network_error: 'Could not reach the server. Check your connection and try again.',
    unexpected_response:
      'The server sent a reply this page does not understand. It may be restarting; try again in a moment.',
  },
};

export type Dictionary = typeof en;

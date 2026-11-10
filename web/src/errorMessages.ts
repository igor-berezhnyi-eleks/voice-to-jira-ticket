import { ApiError } from './api';

export interface ErrorDescription {
  message: string;
  /** Whether sending the same transcript again can plausibly help. */
  retryable: boolean;
}

const genericMessage = 'Something went wrong. Please try again.';

// Messages say what happened and what to do. They never show the code, the HTTP status or server text:
// `llm_unavailable` also covers a rejected key, so it must not claim a cause.
const byCode: Record<string, ErrorDescription> = {
  llm_refused: {
    message: 'The ticket service declined to process this report. Edit the transcript, then press Generate ticket.',
    retryable: false,
  },
  llm_invalid_output: {
    message: 'The ticket service returned a ticket that could not be used. Try again; if it keeps happening, reword the report.',
    retryable: true,
  },
  llm_truncated: {
    message: 'The ticket was cut off because the report is too long to process in one go. Try again, or use a shorter report.',
    retryable: true,
  },
  llm_unavailable: {
    message: 'The ticket service is not available right now. Try again in a moment; if it persists, ask whoever runs this tool to check its setup.',
    retryable: true,
  },
  llm_timeout: {
    message: 'The ticket service took too long to answer. Try again.',
    retryable: true,
  },
  network_error: {
    message: 'Could not reach the server. Check your connection and try again.',
    retryable: true,
  },
  unexpected_response: {
    message: 'The server sent a reply this page does not understand. It may be restarting; try again in a moment.',
    retryable: true,
  },
};

/** Turns a failed generate call into the text Page 1 shows. The transcript is never part of this. */
export function describeGenerationError(error: unknown): ErrorDescription {
  if (!(error instanceof ApiError)) {
    return { message: genericMessage, retryable: true };
  }
  if (error.code === 'validation') {
    return { message: error.message, retryable: false };
  }
  return byCode[error.code] ?? { message: genericMessage, retryable: true };
}

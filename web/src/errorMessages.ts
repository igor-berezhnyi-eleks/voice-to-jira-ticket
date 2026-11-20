import { ApiError } from './api';
import { en, type Dictionary } from './i18n/en';

export interface ErrorDescription {
  message: string;
  /** Whether sending the same transcript again can plausibly help. */
  retryable: boolean;
}

// Messages say what happened and what to do. They never show the code, the HTTP status or server text:
// `llm_unavailable` also covers a rejected key, so it must not claim a cause.
const retryable: Record<keyof Dictionary['errors'], boolean> = {
  llm_refused: false,
  llm_invalid_output: true,
  llm_truncated: true,
  llm_unavailable: true,
  llm_timeout: true,
  network_error: true,
  unexpected_response: true,
};

function isKnownCode(code: string): code is keyof Dictionary['errors'] {
  return Object.hasOwn(retryable, code);
}

/** Turns a failed generate call into the text Page 1 shows. The transcript is never part of this. */
export function describeGenerationError(error: unknown, t: Dictionary = en): ErrorDescription {
  if (!(error instanceof ApiError)) {
    return { message: t.genericError, retryable: true };
  }
  if (error.code === 'validation') {
    return { message: error.message, retryable: false };
  }
  if (isKnownCode(error.code)) {
    return { message: t.errors[error.code], retryable: retryable[error.code] };
  }
  return { message: t.genericError, retryable: true };
}

function isKnownTranslationCode(code: string): code is keyof Dictionary['translationErrors'] {
  return Object.hasOwn(en.translationErrors, code);
}

/** Turns a failed translate call into the text Page 1 shows. The text being translated is never part of this. */
export function describeTranslationError(error: unknown, t: Dictionary = en): string {
  if (!(error instanceof ApiError)) {
    return t.genericError;
  }
  if (error.code === 'validation') {
    return error.message;
  }
  return isKnownTranslationCode(error.code) ? t.translationErrors[error.code] : t.genericError;
}

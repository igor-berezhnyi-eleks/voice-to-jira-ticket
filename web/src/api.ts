import type { TicketSchema } from './contract';

export type Ticket = TicketSchema;

/** The body of a successful POST /api/tickets (plan 4.4). The contract snapshot covers only `ticket`. */
export interface GenerateTicketResponse {
  ticket: Ticket;
  provider: string;
  model: string;
  durationMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

/**
 * A failed API call. `code` is the ProblemDetails `code` extension, or one of two client-side codes:
 * `network_error` (no response; `status` is null) and `unexpected_response` (a response that does not
 * follow the API's format, for example from a proxy with the API stopped).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ProblemDetails {
  code?: unknown;
  title?: unknown;
  detail?: unknown;
  errors?: unknown;
}

function unexpectedResponse(status: number): ApiError {
  return new ApiError('unexpected_response', status, `The server returned an unexpected response (HTTP ${status}).`);
}

// Validation errors are keyed by the C# member name, so only the messages are used, never the keys.
function problemMessage(problem: ProblemDetails, status: number): string {
  if (typeof problem.errors === 'object' && problem.errors !== null) {
    const messages = Object.values(problem.errors).flat().filter((m): m is string => typeof m === 'string');
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  if (typeof problem.detail === 'string' && problem.detail !== '') {
    return problem.detail;
  }
  if (typeof problem.title === 'string' && problem.title !== '') {
    return problem.title;
  }
  return `The request failed (HTTP ${status}).`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw unexpectedResponse(response.status);
  }
}

/**
 * Sends a request and returns the parsed JSON body of a successful response (not yet checked for shape).
 * Throws {@link ApiError} on failure. An abort is rethrown unchanged, as there is nothing to show for it.
 */
async function send(url: string, init: RequestInit, signal: AbortSignal): Promise<{ body: unknown; status: number }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new ApiError('network_error', null, 'Could not reach the server. Check your connection and try again.');
  }

  const body = await readJson(response);
  if (response.ok) {
    return { body, status: response.status };
  }

  const problem = (body ?? {}) as ProblemDetails;
  if (typeof problem.code !== 'string') {
    throw unexpectedResponse(response.status);
  }
  throw new ApiError(problem.code, response.status, problemMessage(problem, response.status));
}

export async function generateTicket(transcript: string, signal: AbortSignal): Promise<GenerateTicketResponse> {
  const { body, status } = await send(
    '/api/tickets',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) },
    signal,
  );
  const result = body as Partial<GenerateTicketResponse> | null;
  if (typeof result?.ticket !== 'object' || result.ticket === null) {
    throw unexpectedResponse(status);
  }
  return result as GenerateTicketResponse;
}

/** The body of a successful POST /api/transcriptions (plan 4.4). `text` is empty for silence. */
export interface TranscriptionResponse {
  text: string;
  durationMs: number;
}

/** Uploads one recording as the multipart field `audio`. */
export async function transcribeAudio(audio: Blob, fileName: string, signal: AbortSignal): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append('audio', audio, fileName);
  // No Content-Type header: the browser adds the multipart boundary.
  const { body, status } = await send('/api/transcriptions', { method: 'POST', body: form }, signal);
  const result = body as Partial<TranscriptionResponse> | null;
  if (typeof result?.text !== 'string') {
    throw unexpectedResponse(status);
  }
  return { text: result.text, durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0 };
}

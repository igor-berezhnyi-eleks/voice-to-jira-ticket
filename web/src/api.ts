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

/** Throws {@link ApiError} on failure. An abort is rethrown unchanged, as there is nothing to show for it. */
export async function generateTicket(transcript: string, signal: AbortSignal): Promise<GenerateTicketResponse> {
  let response: Response;
  try {
    response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new ApiError('network_error', null, 'Could not reach the server. Check your connection and try again.');
  }

  const body = await readJson(response);
  if (response.ok) {
    const result = body as Partial<GenerateTicketResponse> | null;
    if (typeof result?.ticket !== 'object' || result.ticket === null) {
      throw unexpectedResponse(response.status);
    }
    return result as GenerateTicketResponse;
  }

  const problem = (body ?? {}) as ProblemDetails;
  if (typeof problem.code !== 'string') {
    throw unexpectedResponse(response.status);
  }
  throw new ApiError(problem.code, response.status, problemMessage(problem, response.status));
}

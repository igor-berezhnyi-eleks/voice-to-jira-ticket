import { describe, expect, it, vi } from 'vitest';
import { ApiError, generateTicket, transcribeAudio, type GenerateTicketResponse } from './api';

const success: GenerateTicketResponse = {
  ticket: {
    type: 'Feature',
    title: 'Export invoices',
    description: 'Users want to export invoices.',
    bug: null,
    feature: { userNeed: 'Not provided', proposedBehavior: 'Not provided', acceptanceCriteria: [] },
    missingInformation: [],
  },
  provider: 'Fake',
  model: 'fake',
  durationMs: 3,
  usage: null,
};

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function problem(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => {
      throw new Error('Expected the request to fail.');
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('generateTicket', () => {
  it('posts the transcript as JSON and returns the response', async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(success), { status: 200 }));
    const { signal } = new AbortController();

    const result = await generateTicket('A transcript of a report', signal);

    expect(result).toEqual(success);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tickets');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual({ transcript: 'A transcript of a report' });
    expect(init?.signal).toBe(signal);
  });

  it('turns a 400 into an ApiError with the code and the validation messages', async () => {
    // The API keys errors by the C# member name; the client must not depend on the key.
    stubFetch(
      problem(400, {
        title: 'One or more validation errors occurred.',
        status: 400,
        code: 'validation',
        errors: { AnyKey: ['Too short.', 'Still too short.'] },
      }),
    );

    const error = await failure(generateTicket('short', new AbortController().signal));

    expect(error.code).toBe('validation');
    expect(error.status).toBe(400);
    expect(error.message).toBe('Too short. Still too short.');
  });

  it('prefers the detail over the title when there are no validation messages', async () => {
    stubFetch(problem(503, { title: 'Unavailable', detail: 'The generator is down.', status: 503, code: 'llm_unavailable' }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('llm_unavailable');
    expect(error.status).toBe(503);
    expect(error.message).toBe('The generator is down.');
  });

  it('falls back to the title when there is no detail', async () => {
    stubFetch(problem(504, { title: 'Timed out', status: 504, code: 'llm_timeout' }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('llm_timeout');
    expect(error.message).toBe('Timed out');
  });

  it('turns a network failure into an ApiError with no status', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('network_error');
    expect(error.status).toBeNull();
  });

  it('reports an error response that is not ProblemDetails as unexpected', async () => {
    stubFetch(new Response('Internal Server Error', { status: 500 }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('unexpected_response');
    expect(error.status).toBe(500);
    expect(error.message).toContain('500');
  });

  it('reports a JSON error response without a code as unexpected', async () => {
    stubFetch(problem(500, { title: 'Oops' }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('unexpected_response');
  });

  it('reports a successful response with a body that is not JSON as unexpected', async () => {
    stubFetch(new Response('<!doctype html>', { status: 200 }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('unexpected_response');
    expect(error.status).toBe(200);
  });

  it.each(['{}', 'null', '{"ticket":null}'])('reports a successful response without a ticket as unexpected: %s', async (body) => {
    stubFetch(new Response(body, { status: 200 }));

    const error = await failure(generateTicket('A transcript of a report', new AbortController().signal));

    expect(error.code).toBe('unexpected_response');
    expect(error.status).toBe(200);
  });

  it('lets an abort through as an abort, not as a failure to show', async () => {
    const controller = new AbortController();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(abort));
    controller.abort();

    await expect(generateTicket('A transcript of a report', controller.signal)).rejects.toBe(abort);
  });
});

describe('transcribeAudio', () => {
  const audio = new Blob(['sound'], { type: 'audio/webm;codecs=opus' });

  it('posts the recording as the multipart field "audio" and returns the text', async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ text: 'hello there', durationMs: 42 }), { status: 200 }));
    const { signal } = new AbortController();

    const result = await transcribeAudio(audio, 'recording.webm', signal);

    expect(result).toEqual({ text: 'hello there', durationMs: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/transcriptions');
    expect(init?.method).toBe('POST');
    expect(init?.signal).toBe(signal);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    const file = (init?.body as FormData).get('audio') as File;
    expect(file.name).toBe('recording.webm');
    expect(file.type).toBe('audio/webm;codecs=opus');
    expect(file.size).toBe(5);
  });

  it('returns an empty text for silence', async () => {
    stubFetch(new Response(JSON.stringify({ text: '', durationMs: 5 }), { status: 200 }));

    const result = await transcribeAudio(audio, 'recording.webm', new AbortController().signal);

    expect(result.text).toBe('');
  });

  it.each([
    [503, 'stt_unavailable'],
    [504, 'stt_timeout'],
    [413, 'payload_too_large'],
    [400, 'validation'],
  ])('turns a %i answer into an ApiError with code %s', async (status, code) => {
    stubFetch(problem(status, { title: 'Problem', status, code }));

    const error = await failure(transcribeAudio(audio, 'recording.webm', new AbortController().signal));

    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });

  it('turns a network failure into network_error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await failure(transcribeAudio(audio, 'recording.webm', new AbortController().signal));

    expect(error.code).toBe('network_error');
  });

  it.each(['{}', 'null', '{"text":5}'])('reports a successful response without a text as unexpected: %s', async (body) => {
    stubFetch(new Response(body, { status: 200 }));

    const error = await failure(transcribeAudio(audio, 'recording.webm', new AbortController().signal));

    expect(error.code).toBe('unexpected_response');
  });

  it('lets an abort through unchanged', async () => {
    const controller = new AbortController();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(abort));
    controller.abort();

    await expect(transcribeAudio(audio, 'recording.webm', controller.signal)).rejects.toBe(abort);
  });
});

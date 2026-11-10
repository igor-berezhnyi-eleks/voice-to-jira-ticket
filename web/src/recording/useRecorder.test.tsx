import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecorder } from './useRecorder';

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  static isTypeSupported = (type: string) => FakeRecorder.supported.includes(type);

  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    readonly stream: MediaStream,
    options: { mimeType: string },
  ) {
    this.mimeType = options.mimeType;
    FakeRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const trackStop = vi.fn();
const getUserMedia = vi.fn();

function microphone() {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

function transcriptionResponse(text: string) {
  return new Response(JSON.stringify({ text, durationMs: 1 }), { status: 200 });
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ title: 'Problem', status, code }), { status });
}

const flush = () => act(async () => {});

async function startRecording(result: { current: ReturnType<typeof useRecorder> }) {
  act(() => result.current.toggle());
  await flush();
}

async function stopRecording(result: { current: ReturnType<typeof useRecorder> }) {
  act(() => result.current.toggle());
  await flush();
}

beforeEach(() => {
  FakeRecorder.instances = [];
  FakeRecorder.supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  trackStop.mockClear();
  getUserMedia.mockReset().mockImplementation(() => Promise.resolve(microphone()));
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRecorder', () => {
  it('records, uploads on Stop, hands the text over and releases the microphone', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('  hello world  '));
    vi.stubGlobal('fetch', fetchMock);
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));

    await startRecording(result);
    expect(result.current.state.status).toBe('recording');
    expect(FakeRecorder.instances[0].mimeType).toBe('audio/webm;codecs=opus');

    await stopRecording(result);

    expect(onText).toHaveBeenCalledExactlyOnceWith('hello world');
    expect(result.current.state.status).toBe('idle');
    expect(result.current.hasRecording).toBe(true);
    expect(trackStop).toHaveBeenCalled();
    const file = (fetchMock.mock.calls[0][1]?.body as FormData).get('audio') as File;
    expect(file.name).toMatch(/^recording-\d{8}-\d{6}\.webm$/);
    expect(file.type).toBe('audio/webm;codecs=opus');
  });

  it('falls back to the next supported type and names an ogg file .ogg', async () => {
    FakeRecorder.supported = ['audio/ogg;codecs=opus'];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('hi'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);
    await stopRecording(result);

    expect(FakeRecorder.instances[0].mimeType).toBe('audio/ogg;codecs=opus');
    expect(((fetchMock.mock.calls[0][1]?.body as FormData).get('audio') as File).name).toMatch(/\.ogg$/);
  });

  it('never picks audio/mp4: with no accepted type it reports "not supported"', async () => {
    FakeRecorder.supported = ['audio/mp4'];
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state).toMatchObject({ status: 'error' });
    expect(result.current.state.error).toContain('not supported');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('reports "not supported" when MediaRecorder does not exist', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state.error).toContain('not supported');
  });

  it('reports "not supported" when getUserMedia does not exist', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state.error).toContain('not supported');
  });

  it('explains a denied microphone', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain('denied');
    expect(result.current.hasRecording).toBe(false);
  });

  it('explains a missing microphone', async () => {
    getUserMedia.mockRejectedValue(new DOMException('none', 'NotFoundError'));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state.error).toContain('No microphone');
  });

  it('gives a generic message for another microphone failure', async () => {
    getUserMedia.mockRejectedValue(new DOMException('busy', 'NotReadableError'));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);

    expect(result.current.state.error).toContain('could not be started');
  });

  it('can start again after an error', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const { result } = renderHook(() => useRecorder(vi.fn()));
    await startRecording(result);

    await startRecording(result);

    expect(result.current.state).toMatchObject({ status: 'recording', error: null });
  });

  it('shows the no-speech notice and appends nothing for silence', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('   ')));
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));

    await startRecording(result);
    await stopRecording(result);

    expect(onText).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.notice).toContain('No speech');
  });

  it.each(['.', ' . ', '...', '-', '?!'])('treats punctuation-only text %j from the model as silence', async (text) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse(text)));
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));

    await startRecording(result);
    await stopRecording(result);

    expect(onText).not.toHaveBeenCalled();
    expect(result.current.state.notice).toContain('No speech');
  });

  it('keeps punctuation in real speech and text with digits', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse(' 404. ')));
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));

    await startRecording(result);
    await stopRecording(result);

    expect(onText).toHaveBeenCalledExactlyOnceWith('404.');
  });

  it('opens one microphone request when clicked twice quickly, and a click during the prompt cancels it', async () => {
    let grant: (stream: MediaStream) => void = () => undefined;
    getUserMedia.mockImplementation(() => new Promise<MediaStream>((resolve) => (grant = resolve)));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    act(() => result.current.toggle());
    expect(result.current.state.status).toBe('requesting');
    act(() => result.current.toggle()); // Stop while requesting
    expect(result.current.state.status).toBe('idle');

    await act(async () => grant(microphone()));
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(trackStop).toHaveBeenCalled(); // the late stream is released
    expect(result.current.state.status).toBe('idle');
  });

  it('ignores a stale microphone grant after the user has started again', async () => {
    const grants: Array<(stream: MediaStream) => void> = [];
    getUserMedia.mockImplementation(() => new Promise<MediaStream>((resolve) => grants.push(resolve)));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    act(() => result.current.toggle());
    act(() => result.current.toggle()); // cancel
    act(() => result.current.toggle()); // start again
    await act(async () => grants[0](microphone())); // the first request resolves late
    expect(FakeRecorder.instances).toHaveLength(0);

    await act(async () => grants[1](microphone()));
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(result.current.state.status).toBe('recording');
  });

  it('counts seconds and stops by itself at 5:00 as if Stop was pressed', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('long report'));
    vi.stubGlobal('fetch', fetchMock);
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));

    await startRecording(result);
    await act(() => vi.advanceTimersByTimeAsync(65_000));
    expect(result.current.state.elapsedSeconds).toBe(65);

    await act(() => vi.advanceTimersByTimeAsync(234_000));
    expect(result.current.state.status).toBe('recording');
    expect(result.current.state.elapsedSeconds).toBe(299);

    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledExactlyOnceWith('long report');
    expect(result.current.state.status).toBe('idle');
    expect(trackStop).toHaveBeenCalled();
  });

  it('fails the recording when the recorder reports an error, and releases the microphone', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useRecorder(vi.fn()));
    await startRecording(result);

    act(() => FakeRecorder.instances[0].onerror?.());

    expect(result.current.state.status).toBe('error');
    expect(trackStop).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.hasRecording).toBe(false);
  });

  it.each([
    ['stt_unavailable', 503, 'not available'],
    ['stt_timeout', 504, 'too long'],
    ['payload_too_large', 413, 'too large'],
  ])('maps the API code %s to a message and keeps the recording', async (code, status, text) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(problem(status, code)));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);
    await stopRecording(result);

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain(text);
    expect(result.current.hasRecording).toBe(true);
  });

  it('shows the API message for other codes', async () => {
    const body = { title: 'Bad', detail: 'That file type is not supported.', status: 400, code: 'validation' };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 400 })));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);
    await stopRecording(result);

    expect(result.current.state.error).toBe('That file type is not supported.');
  });

  it('reports a network failure and keeps the recording', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);
    await stopRecording(result);

    expect(result.current.state.error).toContain('Could not reach the server');
    expect(result.current.hasRecording).toBe(true);
  });

  it('re-sends the same recording on retry and hands over the text', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(problem(503, 'stt_unavailable'))
      .mockResolvedValueOnce(transcriptionResponse('second try'));
    vi.stubGlobal('fetch', fetchMock);
    const onText = vi.fn();
    const { result } = renderHook(() => useRecorder(onText));
    await startRecording(result);
    await stopRecording(result);

    act(() => result.current.retry());
    expect(result.current.state.status).toBe('transcribing');
    await flush();

    expect(onText).toHaveBeenCalledExactlyOnceWith('second try');
    expect(result.current.state.status).toBe('idle');
    const first = (fetchMock.mock.calls[0][1]?.body as FormData).get('audio') as File;
    const second = (fetchMock.mock.calls[1][1]?.body as FormData).get('audio') as File;
    expect(second.name).toBe(first.name);
    expect(second.size).toBe(first.size);
    expect(FakeRecorder.instances).toHaveLength(1);
  });

  it('ignores retry when there is nothing to retry', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useRecorder(vi.fn()));

    act(() => result.current.retry());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
  });

  it('downloads the kept recording client-side with its file name, also after a success', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('hi')));
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    const { result } = renderHook(() => useRecorder(vi.fn()));
    await startRecording(result);
    await stopRecording(result);

    act(() => result.current.download());

    expect(clicked).toHaveLength(1);
    expect(clicked[0].href).toBe('blob:fake');
    expect(clicked[0].download).toMatch(/^recording-\d{8}-\d{6}\.webm$/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    vi.restoreAllMocks();
  });

  it('stops the recorder, releases the microphone and sends nothing when unmounted while recording', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useRecorder(vi.fn()));
    await startRecording(result);

    unmount();

    expect(FakeRecorder.instances[0].state).toBe('inactive');
    expect(trackStop).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts the upload and ignores its result when unmounted while transcribing', async () => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((_url, init) => {
        signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }),
    );
    const onText = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useRecorder(onText));
    await startRecording(result);
    await act(async () => result.current.toggle());

    unmount();
    await flush();

    expect(signal?.aborted).toBe(true);
    expect(onText).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('does not log to the console during a normal recording', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcriptionResponse('secret words')));
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const { result } = renderHook(() => useRecorder(vi.fn()));

    await startRecording(result);
    await stopRecording(result);

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

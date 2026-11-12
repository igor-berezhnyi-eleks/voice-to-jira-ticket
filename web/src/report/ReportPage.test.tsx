import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportPage } from './ReportPage';

class FakeRecorder {
  static isTypeSupported = () => true;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const getUserMedia = vi.fn();
// jsdom cannot decode audio, so the length is supplied by the test.
const readAudioDuration = vi.hoisted(() => vi.fn());
vi.mock('../recording/audioFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../recording/audioFile')>()),
  readAudioDuration,
}));

function Harness({ initial = '' }: { initial?: string }) {
  const [transcript, setTranscript] = useState(initial);
  return <ReportPage transcript={transcript} onTranscriptChange={setTranscript} onGenerated={() => undefined} />;
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Transcript' });
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const flush = () => act(async () => {});

function transcription(text: string) {
  return new Response(JSON.stringify({ text, durationMs: 1 }), { status: 200 });
}

async function record() {
  fireEvent.click(button('Record'));
  await flush();
}

beforeEach(() => {
  readAudioDuration.mockReset().mockResolvedValue(12);
  getUserMedia.mockReset().mockImplementation(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }));
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
});

describe('Page 1 recorder', () => {
  it('appends each dictated part to the textarea, which stays editable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValueOnce(transcription('first part')).mockResolvedValueOnce(transcription('second part')),
    );
    render(<Harness />);

    await record();
    expect(screen.getByText(/Recording 0:00 \/ 5:00/)).toBeTruthy();
    expect(textarea().disabled).toBe(false);
    fireEvent.click(button('Stop'));
    await flush();
    expect(textarea().value).toBe('first part');

    await record();
    fireEvent.click(button('Stop'));
    await flush();
    expect(textarea().value).toBe('first part second part');
  });

  it('keeps text typed while the recording is being transcribed', async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve))));
    render(<Harness initial="typed before" />);
    await record();
    fireEvent.click(button('Stop'));
    await flush();

    fireEvent.change(textarea(), { target: { value: 'typed before and during' } });
    await act(async () => respond(transcription('dictated')));

    expect(textarea().value).toBe('typed before and during dictated');
  });

  it('disables Generate while recording or transcribing, and Record while transcribing', async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve))));
    render(<Harness initial={'x'.repeat(30)} />);
    expect(button('Generate ticket').disabled).toBe(false);

    await record();
    expect(button('Generate ticket').disabled).toBe(true);

    fireEvent.click(button('Stop'));
    await flush();
    expect(screen.getByText('Transcribing…')).toBeTruthy();
    expect(button('Generate ticket').disabled).toBe(true);
    expect(button('Record').disabled).toBe(true);

    await act(async () => respond(transcription('done')));
    expect(button('Generate ticket').disabled).toBe(false);
    expect(button('Record').disabled).toBe(false);
  });

  it('disables Record while a ticket is being generated', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise(() => undefined)));
    render(<Harness initial={'x'.repeat(30)} />);

    fireEvent.click(button('Generate ticket'));

    expect(button('Record').disabled).toBe(true);
  });

  describe('generation errors', () => {
    const problem = (code: string, status: number) =>
      new Response(JSON.stringify({ title: 'raw title', status, code }), { status });
    const ticketResponse = () =>
      new Response(JSON.stringify({ ticket: { type: 'Bug' }, provider: 'Fake', model: 'm', durationMs: 1, usage: null }), {
        status: 200,
      });
    const sentTranscripts = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) =>
      fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).transcript);

    it('shows a readable message with Retry, keeps the transcript, and Retry sends the edited text', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(problem('llm_unavailable', 503))
        .mockResolvedValueOnce(problem('llm_unavailable', 503));
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness initial={'a'.repeat(30)} />);

      fireEvent.click(button('Generate ticket'));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).not.toContain('raw title');
      expect(alert.textContent).not.toContain('llm_unavailable');
      expect(button('Retry')).toBeTruthy();
      expect(textarea().value).toBe('a'.repeat(30));
      expect(button('Generate ticket').disabled).toBe(false);

      fireEvent.change(textarea(), { target: { value: 'b'.repeat(30) } });
      fireEvent.click(button('Retry'));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('Generating…')).toBeTruthy();
      await flush();

      expect(sentTranscripts(fetchMock)).toEqual(['a'.repeat(30), 'b'.repeat(30)]);
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(textarea().value).toBe('b'.repeat(30));
    });

    it('offers no Retry after a refusal', async () => {
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(problem('llm_refused', 422)));
      render(<Harness initial={'a'.repeat(30)} />);

      fireEvent.click(button('Generate ticket'));

      expect((await screen.findByRole('alert')).textContent).toMatch(/edit/i);
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
      expect(textarea().value).toBe('a'.repeat(30));
    });

    it('a successful Retry hands the ticket on and clears the error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValueOnce(problem('llm_timeout', 504)).mockResolvedValueOnce(ticketResponse()),
      );
      const onGenerated = vi.fn();
      render(<ReportPage transcript={'a'.repeat(30)} onTranscriptChange={() => undefined} onGenerated={onGenerated} />);

      fireEvent.click(button('Generate ticket'));
      await screen.findByRole('alert');
      fireEvent.click(button('Retry'));
      await flush();

      expect(onGenerated).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });
  });

  it('shows a clear message when the microphone is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<Harness />);

    await record();

    expect((await screen.findByRole('alert')).textContent).toContain('Microphone access was denied');
    expect(screen.queryByRole('button', { name: 'Download recording' })).toBeNull();
    expect(button('Record').disabled).toBe(false);
  });

  it('after a transcription error keeps the recording: Try again re-sends it, Download is offered', async () => {
    const problem = new Response(JSON.stringify({ title: 'x', status: 503, code: 'stt_unavailable' }), { status: 503 });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(problem).mockResolvedValueOnce(transcription('recovered'));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness initial="existing" />);
    await record();
    fireEvent.click(button('Stop'));
    await flush();

    expect(screen.getByRole('alert').textContent).toContain('not available');
    expect(button('Download recording')).toBeTruthy();
    expect(textarea().value).toBe('existing');

    fireEvent.click(button('Try again'));
    await flush();

    expect(textarea().value).toBe('existing recovered');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(button('Download recording')).toBeTruthy();
  });

  it('does not offer Try again after a microphone error that follows an earlier recording', async () => {
    const problem = new Response(JSON.stringify({ title: 'x', status: 503, code: 'stt_unavailable' }), { status: 503 });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(problem));
    render(<Harness />);
    await record();
    fireEvent.click(button('Stop'));
    await flush();
    expect(button('Try again')).toBeTruthy();

    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await record();

    expect(screen.getByRole('alert').textContent).toContain('denied');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(button('Download recording')).toBeTruthy();
  });

  it('says so when no speech was detected and leaves the text alone', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(transcription('')));
    render(<Harness initial="existing" />);
    await record();
    fireEvent.click(button('Stop'));
    await flush();

    expect(screen.getByText(/No speech was detected/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(textarea().value).toBe('existing');
  });

  describe('upload', () => {
    const fileInput = () => screen.getByLabelText<HTMLInputElement>('Audio file');
    const choose = async (file: File) => {
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await flush();
    };
    const wav = (name = 'memo.wav', type = 'audio/x-wav') => new File(['riff'], name, { type });

    it('limits the picker to the four formats and sends the type of the extension', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(transcription('uploaded words'));
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness initial="typed" />);
      expect(fileInput().accept).toBe('.wav,.mp3,.webm,.ogg');

      await choose(wav());

      expect(textarea().value).toBe('typed uploaded words');
      const sent = (fetchMock.mock.calls[0][1]?.body as FormData).get('audio') as File;
      expect(sent.name).toBe('memo.wav');
      expect(sent.type).toBe('audio/wav');
      expect(button('Download recording')).toBeTruthy();
    });

    it('opens the file picker from the button and disables it while transcribing', async () => {
      let respond: (response: Response) => void = () => undefined;
      vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve))));
      render(<Harness initial={'x'.repeat(30)} />);
      const picker = vi.spyOn(fileInput(), 'click');
      fireEvent.click(button('Upload recording'));
      expect(picker).toHaveBeenCalledOnce();

      await choose(wav());
      expect(screen.getByText('Transcribing…')).toBeTruthy();
      expect(button('Upload recording').disabled).toBe(true);
      expect(button('Record').disabled).toBe(true);
      expect(button('Generate ticket').disabled).toBe(true);

      await act(async () => respond(transcription('done')));
      expect(button('Upload recording').disabled).toBe(false);
      expect(button('Record').disabled).toBe(false);
    });

    it('disables Upload while a ticket is generated', async () => {
      vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise(() => undefined)));
      render(<Harness initial={'x'.repeat(30)} />);

      fireEvent.click(button('Generate ticket'));
      expect(button('Upload recording').disabled).toBe(true);
    });

    it('disables Upload while recording', async () => {
      vi.stubGlobal('fetch', vi.fn<typeof fetch>());
      render(<Harness />);
      await record();
      expect(button('Upload recording').disabled).toBe(true);
    });

    it('refuses an unsupported file and sends nothing', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness initial="existing" />);

      await choose(wav('memo.m4a', 'audio/mp4'));

      expect(screen.getByRole('alert').textContent).toContain('not supported');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(button('Upload recording').disabled).toBe(false);
      expect(textarea().value).toBe('existing');
    });

    it('refuses a file longer than 5:00 and names its length', async () => {
      readAudioDuration.mockResolvedValue(367);
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness />);

      await choose(wav());

      expect(screen.getByRole('alert').textContent).toContain('6:07');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends a file whose length cannot be read', async () => {
      readAudioDuration.mockResolvedValue(null);
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(transcription('still sent'));
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness />);

      await choose(wav());

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(textarea().value).toBe('still sent');
    });

    it('after a transcription error Try again re-sends the uploaded file', async () => {
      const down = new Response(JSON.stringify({ title: 'x', status: 503, code: 'stt_unavailable' }), { status: 503 });
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(down).mockResolvedValueOnce(transcription('recovered'));
      vi.stubGlobal('fetch', fetchMock);
      render(<Harness />);

      await choose(wav());
      expect(screen.getByRole('alert').textContent).toContain('not available');
      expect(button('Download recording')).toBeTruthy();

      fireEvent.click(button('Try again'));
      await flush();

      expect(textarea().value).toBe('recovered');
      const sent = fetchMock.mock.calls.map(([, init]) => ((init?.body as FormData).get('audio') as File).name);
      expect(sent).toEqual(['memo.wav', 'memo.wav']);
    });

    it('says an undecodable file is unreadable, not that the service is down, and offers no Try again', async () => {
      const unreadable = new Response(JSON.stringify({ title: 'x', status: 422, code: 'audio_unreadable' }), { status: 422 });
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(unreadable));
      render(<Harness initial="existing" />);

      await choose(wav('fake.mp3', 'audio/mpeg'));

      const message = screen.getByRole('alert').textContent ?? '';
      expect(message).toContain('could not be read');
      expect(message).not.toContain('not available');
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(button('Upload recording').disabled).toBe(false);
      expect(textarea().value).toBe('existing');
    });

    it('shows the hint with the accepted formats', () => {
      render(<Harness />);
      expect(screen.getByText(/\.wav, \.mp3, \.webm or \.ogg/)).toBeTruthy();
    });
  });
});

describe('Page 1 transcript counter', () => {
  it('shows the minimum below the limit and the 20,000-character limit above it', () => {
    render(<Harness initial={'x'.repeat(5)} />);
    expect(screen.getByText('5 characters, at least 20 needed')).toBeTruthy();

    fireEvent.change(textarea(), { target: { value: 'x'.repeat(20_000) } });
    expect(screen.getByText('20000 characters, at least 20 needed')).toBeTruthy();

    fireEvent.change(textarea(), { target: { value: 'x'.repeat(20_001) } });
    expect(screen.getByText('20001 characters, over the 20,000-character limit')).toBeTruthy();
    expect(screen.queryByText(/at least 20 needed/)).toBeNull();
  });
});

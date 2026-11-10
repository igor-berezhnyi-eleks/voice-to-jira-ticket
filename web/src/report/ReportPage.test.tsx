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
});

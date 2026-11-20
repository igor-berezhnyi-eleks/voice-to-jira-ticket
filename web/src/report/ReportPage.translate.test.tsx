import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { languageStorageKey } from '../i18n/languagePreference';
import { ReportPage } from './ReportPage';

function Harness({ initial = '', onGenerated = () => undefined }: { initial?: string; onGenerated?: () => void }) {
  const [transcript, setTranscript] = useState(initial);
  return (
    <LanguageProvider>
      <ReportPage transcript={transcript} onTranscriptChange={setTranscript} onGenerated={onGenerated} />
    </LanguageProvider>
  );
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: /Transcript|Транскрипт/ });
const find = (name: string | RegExp) => screen.queryByRole<HTMLButtonElement>('button', { name });
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
const sentBody = (mock: { mock: { calls: Parameters<typeof fetch>[] } }, call: number): unknown =>
  JSON.parse(String(mock.mock.calls[call][1]?.body));
const flush = () => act(async () => {});

function translation(text: string, from: string, to = 'en') {
  return new Response(JSON.stringify({ text, from, to, model: 'fake', durationMs: 1 }), { status: 200 });
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ code, title: 'x' }), { status, headers: { 'Content-Type': 'application/problem+json' } });
}

afterEach(() => localStorage.removeItem(languageStorageKey));

describe('Page 1 translate buttons', () => {
  it('offers one button, to English, for Cyrillic text whatever the selected language', () => {
    const { unmount } = render(<Harness initial="Привіт, світе" />);
    expect(screen.queryAllByRole('button', { name: /^Translate/ })).toHaveLength(1);
    expect(find('Translate to English')).not.toBeNull();
    unmount();

    localStorage.setItem(languageStorageKey, 'uk');
    render(<Harness initial="Привіт, світе" />);
    expect(screen.queryAllByRole('button', { name: /^Перекласти/ })).toHaveLength(1);
    expect(find('Перекласти англійською')).not.toBeNull();
  });

  it('offers one button, to the selected language, for non-Cyrillic text while another language is selected', () => {
    localStorage.setItem(languageStorageKey, 'uk');
    render(<Harness initial="Hello there" />);
    expect(screen.queryAllByRole('button', { name: /^Перекласти/ })).toHaveLength(1);
    expect(find('Перекласти: Українська')).not.toBeNull();
  });

  it('follows the text: the button changes when Cyrillic appears in the first characters', () => {
    localStorage.setItem(languageStorageKey, 'uk');
    render(<Harness initial="Hello there" />);
    fireEvent.change(textarea(), { target: { value: 'Привіт there' } });
    expect(find('Перекласти англійською')).not.toBeNull();
    expect(find('Перекласти: Українська')).toBeNull();
  });

  it('disables the buttons while the box is empty and enables them once there is text', () => {
    render(<Harness />);
    expect(button('Translate to English').disabled).toBe(true);
    fireEvent.change(textarea(), { target: { value: 'something' } });
    expect(button('Translate to English').disabled).toBe(false);
  });

  it('sends the text and target, then replaces the text and offers Undo with the detected language', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(translation('Hello world', 'uk'));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness initial="Привіт, світе" />);

    fireEvent.click(button('Translate to English'));
    await flush();

    expect(sentBody(fetchMock, 0)).toEqual({ text: 'Привіт, світе', to: 'en' });
    expect(textarea().value).toBe('Hello world');
    expect(screen.getByText('Translated from Ukrainian')).toBeTruthy();
    expect(find('Undo')).not.toBeNull();
  });

  it('translates to the selected language with its code', async () => {
    localStorage.setItem(languageStorageKey, 'uk');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(translation('Привіт', 'en', 'uk'));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness initial="Hello" />);

    fireEvent.click(button('Перекласти: Українська'));
    await flush();

    expect(sentBody(fetchMock, 0)).toEqual({ text: 'Hello', to: 'uk' });
    expect(textarea().value).toBe('Привіт');
    expect(screen.getByText('Перекладено з англійської')).toBeTruthy();
  });

  it('disables everything that could change the text while a translation runs', async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve))));
    render(<Harness initial={'x'.repeat(30)} />);

    fireEvent.click(button('Translate to English'));
    await flush();
    expect(screen.getByText('Translating…')).toBeTruthy();
    expect(button('Translate to English').disabled).toBe(true);
    expect(button('Generate ticket').disabled).toBe(true);
    expect(button('Record').disabled).toBe(true);

    await act(async () => respond(translation('y'.repeat(30), 'uk')));
    expect(button('Generate ticket').disabled).toBe(false);
  });

  it('Undo restores the exact earlier text, spaces and line breaks included', async () => {
    const original = '  Привіт,\n\nсвіте  ';
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(translation('Hello, world', 'uk')));
    render(<Harness initial={original} />);

    fireEvent.click(button('Translate to English'));
    await flush();
    fireEvent.click(button('Undo'));

    expect(textarea().value).toBe(original);
    expect(find('Undo')).toBeNull();
    expect(screen.queryByText(/Translated from/)).toBeNull();
  });

  it('clears Undo on any edit', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(translation('Hello, world', 'uk')));
    render(<Harness initial="Привіт, світе" />);
    fireEvent.click(button('Translate to English'));
    await flush();

    fireEvent.change(textarea(), { target: { value: 'Hello, world!' } });

    expect(find('Undo')).toBeNull();
    expect(screen.queryByText(/Translated from/)).toBeNull();
  });

  it('a second translation keeps one Undo, which restores the text before that translation', async () => {
    localStorage.setItem(languageStorageKey, 'uk');
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(translation('Hello', 'uk'))
        .mockResolvedValueOnce(translation('Привіт', 'en', 'uk')),
    );
    render(<Harness initial="Привіт" />);

    fireEvent.click(button('Перекласти англійською'));
    await flush();
    fireEvent.click(button('Перекласти: Українська'));
    await flush();
    expect(textarea().value).toBe('Привіт');
    expect(screen.getAllByRole('button', { name: 'Скасувати' })).toHaveLength(1);

    fireEvent.click(button('Скасувати'));
    expect(textarea().value).toBe('Hello');
  });

  it('generates from the edited text, not the translation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(translation('The export button crashes', 'uk'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: { type: 'Bug' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onGenerated = vi.fn();
    render(<Harness initial="Кнопка експорту падає щоразу" onGenerated={onGenerated} />);

    fireEvent.click(button('Translate to English'));
    await flush();
    fireEvent.change(textarea(), { target: { value: 'The export button crashes every time' } });
    fireEvent.click(button('Generate ticket'));
    await flush();

    expect(fetchMock.mock.calls[1][0]).toBe('/api/tickets');
    expect(sentBody(fetchMock, 1)).toEqual({ transcript: 'The export button crashes every time' });
    expect(onGenerated).toHaveBeenCalled();
  });

  it('says so, and changes nothing, when the text is already in the target language', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(translation('ignored', 'en')));
    render(<Harness initial="Already English text" />);

    fireEvent.click(button('Translate to English'));
    await flush();

    expect(textarea().value).toBe('Already English text');
    expect(screen.getByText(/already in English/)).toBeTruthy();
    expect(find('Undo')).toBeNull();
  });

  it.each([
    ['llm_timeout', 504, /took too long/],
    ['llm_unavailable', 503, /not available/],
    ['translation_pair_unsupported', 422, /English first/],
  ])('shows a translated message for %s and leaves the text unchanged', async (code, status, message) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(problem(status, code)));
    render(<Harness initial="Привіт, світе" />);

    fireEvent.click(button('Translate to English'));
    await flush();

    expect(screen.getByRole('alert').textContent).toMatch(message);
    expect(textarea().value).toBe('Привіт, світе');
    expect(find('Undo')).toBeNull();
  });

  it('shows the network error in Ukrainian and keeps the text', async () => {
    localStorage.setItem(languageStorageKey, 'uk');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('failed')));
    render(<Harness initial="Hello" />);

    fireEvent.click(button('Перекласти: Українська'));
    await flush();

    expect(screen.getByRole('alert').textContent).toMatch(/зв’язатися/);
    expect(textarea().value).toBe('Hello');
  });
});

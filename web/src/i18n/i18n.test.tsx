import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageHeader } from '../layout/PageHeader';
import { ReportPage } from '../report/ReportPage';
import { en } from './en';
import { LanguageProvider } from './LanguageProvider';
import { languageStorageKey, readLanguage } from './languagePreference';
import { plural } from './plural';
import { uk } from './uk';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(transcript = '') {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <PageHeader activeStep={0} />
      <ReportPage transcript={transcript} onTranscriptChange={onChange} onGenerated={vi.fn()} />
    </LanguageProvider>,
  );
}

const selector = () => screen.getByLabelText<HTMLSelectElement>(en.languageSelector);

describe('language preference', () => {
  it('defaults to English and sets <html lang>', () => {
    mount();
    expect(selector().value).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to English for an unknown stored value', () => {
    window.localStorage.setItem(languageStorageKey, 'fr');
    expect(readLanguage()).toBe('en');
  });

  it('falls back to English when storage is blocked, and still switches', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    mount();
    expect(selector().value).toBe('en');
    fireEvent.change(selector(), { target: { value: 'uk' } });
    expect(screen.getByRole('button', { name: new RegExp(uk.generateTicket) })).toBeTruthy();
  });

  it('remembers the choice and restores it on the next visit', () => {
    mount();
    fireEvent.change(selector(), { target: { value: 'uk' } });
    expect(window.localStorage.getItem(languageStorageKey)).toBe('uk');
    expect(document.documentElement.lang).toBe('uk');
    cleanup();
    mount();
    expect(screen.getByLabelText<HTMLSelectElement>(uk.languageSelector).value).toBe('uk');
  });

  it('offers each language under its own name', () => {
    mount();
    const names = Array.from(selector().options).map((option) => option.textContent);
    expect(names).toEqual(['English', 'Українська']);
  });
});

function cleanup() {
  document.body.innerHTML = '';
}

describe('Page 1 in Ukrainian', () => {
  it('shows no English text from the dictionary', () => {
    window.localStorage.setItem(languageStorageKey, 'uk');
    mount('Короткий текст для перевірки');
    const text = document.body.textContent ?? '';
    for (const english of [
      en.reportTitle,
      en.record,
      en.uploadRecording,
      en.generateTicket,
      en.translate,
      en.transcript,
      ...en.steps.filter((step) => step !== 'Jira'),
    ]) {
      expect(text, english).not.toContain(english);
    }
    expect(screen.getByText(uk.reportTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(uk.record) })).toBeTruthy();
    expect(screen.getByLabelText(uk.progress)).toBeTruthy();
  });

  it('keeps the textbox text when the language changes', () => {
    mount('Текст, який не має зникнути');
    const box = () => screen.getByLabelText<HTMLTextAreaElement>(en.transcript);
    expect(box().value).toBe('Текст, який не має зникнути');
    fireEvent.change(selector(), { target: { value: 'uk' } });
    expect(screen.getByLabelText<HTMLTextAreaElement>(uk.transcript).value).toBe('Текст, який не має зникнути');
  });

  it('gives the counter Ukrainian plural forms', () => {
    window.localStorage.setItem(languageStorageKey, 'uk');
    mount('x'.repeat(21));
    expect(screen.getByText('21 символ, потрібно щонайменше 20')).toBeTruthy();
  });

  it('gives MUI built-in texts the Ukrainian locale, merged with the outer theme', () => {
    window.localStorage.setItem(languageStorageKey, 'uk');
    function Probe() {
      const theme = useTheme();
      return <p data-testid="probe">{theme.components?.MuiTablePagination?.defaultProps?.labelRowsPerPage as string}|{theme.palette.mode}</p>;
    }
    render(
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <LanguageProvider>
          <Probe />
        </LanguageProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('Рядків на сторінці:|dark');
  });
});

describe('plural forms', () => {
  it.each([
    [1, 'символ'],
    [2, 'символи'],
    [5, 'символів'],
    [11, 'символів'],
    [21, 'символ'],
    [24, 'символи'],
    [25, 'символів'],
  ])('uk %i is %s', (count, word) => {
    expect(uk.charactersNeeded(count, 20)).toContain(` ${word},`);
  });

  it('en separates one from other', () => {
    expect(plural('en', 1, { one: 'a', other: 'b' })).toBe('a');
    expect(plural('en', 2, { one: 'a', other: 'b' })).toBe('b');
  });
});

describe('dictionaries', () => {
  it('have the same shape', () => {
    const shape = (value: unknown): unknown =>
      typeof value === 'function' ? 'fn' : value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
        : Array.isArray(value) ? `array${value.length}` : 'string';
    expect(shape(uk)).toEqual(shape(en));
  });
});

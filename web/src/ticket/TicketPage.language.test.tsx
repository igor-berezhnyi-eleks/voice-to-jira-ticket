import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse, Ticket } from '../api';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { languageStorageKey } from '../i18n/languagePreference';
import { downloadText } from './exportFile';
import { TicketPage } from './TicketPage';

vi.mock('./exportFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./exportFile')>()),
  downloadText: vi.fn(),
}));

const ukBug: Ticket = {
  type: 'Bug',
  language: 'uk',
  title: 'Збій збереження рахунку',
  description: 'Редактор закривається.',
  bug: { stepsToReproduce: ['Відкрити рахунок'], actualResult: 'Редактор закривається.', expectedResult: 'Not provided', environment: 'Chrome' },
  feature: null,
  missingInformation: [],
};

const enBug: Ticket = { ...ukBug, language: 'en', title: 'Saving crashes', description: 'The editor closes.' };

function show(ticket: Ticket, uiLanguage: 'en' | 'uk') {
  window.localStorage.setItem(languageStorageKey, uiLanguage);
  const response: GenerateTicketResponse = { ticket, provider: 'Fake', model: 'fake', durationMs: 1, usage: null };
  return render(
    <LanguageProvider>
      <TicketPage response={response} transcript="t" onBack={() => undefined} onRegenerated={() => undefined} />
    </LanguageProvider>,
  );
}

const preview = (label: string) => (screen.getByLabelText(label) as HTMLTextAreaElement).value;
const box = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement;

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(downloadText).mockClear();
});
afterEach(cleanup);

describe('a ticket in its own language', () => {
  it('shows a Ukrainian ticket in Ukrainian under an English UI', () => {
    show(ukBug, 'en');

    expect(screen.getByText('Review ticket')).toBeTruthy();
    expect(preview('Preview')).toContain('Тип: Bug');
    expect(preview('Preview')).toContain('Очікуваний результат\nНе вказано');
    expect(preview('Preview')).not.toContain('Not provided');
    // Page 2 input labels are UI chrome: English here.
    expect(box('Expected result').value).toBe('Не вказано');
  });

  it('shows an English ticket in English under a Ukrainian UI', () => {
    show(enBug, 'uk');

    expect(preview('Попередній перегляд')).toContain('Type: Bug');
    expect(preview('Попередній перегляд')).toContain('Expected result\nNot provided');
    expect(box('Очікуваний результат').value).toBe('Not provided');
  });

  it('keeps the contract marker when the phrase is left in or typed back, and saves contract-shaped JSON', async () => {
    show(ukBug, 'en');
    fireEvent.change(box('Environment / platform'), { target: { value: 'Не вказано' } });
    fireEvent.change(box('Actual result'), { target: { value: 'Падає' } });

    expect(box('Environment / platform').closest('.not-provided')).not.toBeNull();
    expect(box('Actual result').closest('.not-provided')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save as JSON' }));
    await waitFor(() => expect(downloadText).toHaveBeenCalledOnce());
    const saved = JSON.parse(vi.mocked(downloadText).mock.calls[0][1]) as Ticket;
    expect(saved.language).toBe('uk');
    expect(saved.bug?.expectedResult).toBe('Not provided');
    expect(saved.bug?.environment).toBe('Not provided');
    expect(saved.bug?.actualResult).toBe('Падає');
  });

  it('uses the ticket language in the Jira wiki preview', () => {
    show(ukBug, 'en');
    fireEvent.click(screen.getByLabelText('Jira wiki'));

    expect(preview('Preview')).toContain('h2. Очікуваний результат\nНе вказано');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse } from './api';
import { App } from './App';

const transcript = 'The invoice editor crashes when the date is empty.';
const bannerText = 'Fake generator active — tickets are not real';

function ticketResponse(provider: string): Response {
  const body: GenerateTicketResponse = {
    ticket: {
      type: 'Bug',
      title: 'The invoice editor crashes when the date is empty',
      description: transcript,
      bug: { stepsToReproduce: [], actualResult: 'Not provided', expectedResult: 'Not provided', environment: 'Not provided' },
      feature: null,
      missingInformation: [],
    },
    provider,
    model: provider === 'Fake' ? 'fake' : 'real-model',
    durationMs: 1,
    usage: null,
  };
  return new Response(JSON.stringify(body), { status: 200 });
}

function validationProblem(): Response {
  return new Response(
    JSON.stringify({ title: 'Invalid', status: 400, code: 'validation', errors: { Transcript: ['The transcript is too short.'] } }),
    { status: 400 },
  );
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Transcript' });
const generateButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Generate ticket' });
const type = (value: string) => fireEvent.change(textarea(), { target: { value } });

describe('Page 1', () => {
  it('disables Generate under 20 characters and enables it at 20', () => {
    render(<App />);
    expect(generateButton().disabled).toBe(true);

    type('x'.repeat(19));
    expect(generateButton().disabled).toBe(true);

    type('x'.repeat(20));
    expect(generateButton().disabled).toBe(false);
  });

  it('disables Generate while a request runs and sends only one request', async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise((resolve) => (respond = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    expect(generateButton().disabled).toBe(true);
    fireEvent.click(generateButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respond(ticketResponse('Fake'));
    await screen.findByRole('button', { name: 'Back to transcript' });
  });

  it('shows the error and keeps the transcript when the API rejects the request', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(validationProblem()));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The transcript is too short.');
    expect(textarea().value).toBe(transcript);
    expect(generateButton().disabled).toBe(false);
  });

  it('shows an error and keeps the transcript when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    await screen.findByRole('alert');
    expect(textarea().value).toBe(transcript);
  });

  it('removes the previous error as soon as a retry starts', async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(validationProblem())
        .mockImplementationOnce(() => new Promise((resolve) => (respond = resolve))),
    );
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('alert');
    fireEvent.click(generateButton());

    expect(screen.queryByRole('alert')).toBeNull();

    respond(ticketResponse('Fake'));
    await screen.findByRole('button', { name: 'Back to transcript' });
  });
});

describe('moving between the pages', () => {
  it('shows the ticket after Generate, and Back returns with the transcript intact', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Fake')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());

    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    expect(title.value).toBe('The invoice editor crashes when the date is empty');

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));

    expect(textarea().value).toBe(transcript);
  });
});

describe('fake generator banner', () => {
  it('is absent until a response names the provider', () => {
    render(<App />);
    expect(screen.queryByText(bannerText)).toBeNull();
  });

  it('shows on Page 2 and stays after Back when the provider is Fake', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Fake')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('button', { name: 'Back to transcript' });
    expect(screen.getByText(bannerText)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back to transcript' }));
    expect(screen.getByText(bannerText)).toBeTruthy();
  });

  it('does not show for another provider', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(ticketResponse('Claude')));
    render(<App />);
    type(transcript);

    fireEvent.click(generateButton());
    await screen.findByRole('button', { name: 'Back to transcript' });

    expect(screen.queryByText(bannerText)).toBeNull();
  });
});

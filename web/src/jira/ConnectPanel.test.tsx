import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPanel, SITE_URL_KEY } from './ConnectPanel';
import { bodyOf, jsonResponse, problem, stubJiraFetch } from './fakeJira';

const address = () => screen.getByLabelText<HTMLInputElement>('Jira address');
const email = () => screen.getByLabelText<HTMLInputElement>('Atlassian email');
const token = () => screen.getByLabelText<HTMLInputElement>('API token');
const connect = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Connect' });

const noop = () => undefined;
const panel = (extra: Partial<Parameters<typeof ConnectPanel>[0]> = {}) => (
  <ConnectPanel defaultSiteUrl="https://example.atlassian.net" allowedHosts={['*.atlassian.net']} onConnected={noop} onCancel={noop} {...extra} />
);

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

function fill() {
  fireEvent.change(email(), { target: { value: 'me@example.com' } });
  fireEvent.change(token(), { target: { value: 'secret-token' } });
}

describe('ConnectPanel', () => {
  it('has a password token field without autocomplete, a token page link, the notice and Cancel', () => {
    render(panel());

    expect(token().type).toBe('password');
    expect(token().getAttribute('autocomplete')).toBe('off');
    const link = screen.getByRole('link', { name: /Create an API token/ });
    expect(link.getAttribute('href')).toBe('https://id.atlassian.com/manage-profile/security/api-tokens');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/same rights as you in Jira/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('keeps Connect disabled until both fields are filled', () => {
    render(panel());
    expect(connect().disabled).toBe(true);
    fireEvent.change(email(), { target: { value: 'me@example.com' } });
    expect(connect().disabled).toBe(true);
    fireEvent.change(token(), { target: { value: 'x' } });
    expect(connect().disabled).toBe(false);
  });

  it('posts the credentials, reports the display name and clears the token', async () => {
    const fetchMock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const onConnected = vi.fn();
    render(panel({ onConnected }));
    fill();

    fireEvent.click(connect());

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('Ada L'));
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ siteUrl: 'https://example.atlassian.net', login: 'me@example.com', secret: 'secret-token' });
    expect(token().value).toBe('');
  });

  it('shows the scopes hint on jira_auth_denied and clears the token', async () => {
    stubJiraFetch({ 'POST /api/jira/session': () => problem(401, 'jira_auth_denied') });
    const onConnected = vi.fn();
    render(panel({ onConnected }));
    fill();

    fireEvent.click(connect());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('without scopes');
    expect(token().value).toBe('');
    expect(email().value).toBe('me@example.com');
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('calls onCancel', () => {
    const onCancel = vi.fn();
    render(panel({ onCancel }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('pre-fills the configured address and lists the allowed hosts', () => {
    render(panel({ allowedHosts: ['*.atlassian.net', 'jira.company.com'] }));

    expect(address().value).toBe('https://example.atlassian.net');
    expect(screen.getByText(/\*\.atlassian\.net, jira\.company\.com/)).toBeTruthy();
  });

  it('starts empty when no default is configured and keeps Connect disabled until an address is typed', () => {
    render(panel({ defaultSiteUrl: null }));
    fill();

    expect(address().value).toBe('');
    expect(connect().disabled).toBe(true);
    fireEvent.change(address(), { target: { value: 'https://jira.company.com' } });
    expect(connect().disabled).toBe(false);
  });

  it('prefers the remembered address over the default', () => {
    window.localStorage.setItem(SITE_URL_KEY, 'https://jira.company.com');

    render(panel());

    expect(address().value).toBe('https://jira.company.com');
  });

  it('sends the typed address and remembers it, and only it, after connecting', async () => {
    const fetchMock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const onConnected = vi.fn();
    render(panel({ onConnected }));
    fill();
    fireEvent.change(address(), { target: { value: ' https://jira.company.com/jira ' } });

    fireEvent.click(connect());

    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(bodyOf(fetchMock.mock.calls[0]).siteUrl).toBe('https://jira.company.com/jira');
    expect(window.localStorage.getItem(SITE_URL_KEY)).toBe('https://jira.company.com/jira');
    const stored = JSON.stringify(Object.entries(window.localStorage));
    expect(stored).not.toContain('secret-token');
    expect(stored).not.toContain('me@example.com');
  });

  it('does not remember an address that failed', async () => {
    stubJiraFetch({ 'POST /api/jira/session': () => problem(400, 'validation', { detail: 'This Jira address is not allowed.' }) });
    render(panel());
    fill();
    fireEvent.change(address(), { target: { value: 'https://evil.example.com' } });

    fireEvent.click(connect());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('not allowed');
    expect(window.localStorage.getItem(SITE_URL_KEY)).toBeNull();
    expect(address().value).toBe('https://evil.example.com');
  });

  it('still works when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const onConnected = vi.fn();
    render(panel({ onConnected }));
    fill();

    expect(address().value).toBe('https://example.atlassian.net');
    fireEvent.click(connect());

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('Ada L'));
    vi.restoreAllMocks();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTIONS_KEY, ConnectPanel, guessType, SITE_URL_KEY } from './ConnectPanel';
import { bodyOf, jsonResponse, problem, stubJiraFetch } from './fakeJira';

const address = () => screen.getByLabelText<HTMLInputElement>('Jira address');
const email = () => screen.getByLabelText<HTMLInputElement>('Atlassian email');
const token = () => screen.getByLabelText<HTMLInputElement>('API token');
const connect = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Connect' });
const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });

const noop = () => undefined;
const panel = (extra: Partial<Parameters<typeof ConnectPanel>[0]> = {}) => (
  <ConnectPanel
    defaultSiteUrl="https://example.atlassian.net"
    allowedHosts={['*.atlassian.net']}
    deployment="Cloud"
    authScheme="Basic"
    defaultServerAuthScheme="Bearer"
    onConnected={noop}
    onCancel={noop}
    {...extra}
  />
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
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      siteUrl: 'https://example.atlassian.net',
      deployment: 'Cloud',
      authScheme: 'Basic',
      login: 'me@example.com',
      secret: 'secret-token',
    });
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

  it('guesses Cloud for atlassian.net, Server for other complete hosts and nothing for an incomplete one', () => {
    expect(guessType('https://acme.atlassian.net')).toBe('Cloud');
    expect(guessType('acme.Atlassian.NET/')).toBe('Cloud');
    expect(guessType('https://jira.company.com:8443/jira')).toBe('Server');
    expect(guessType('https://atlassian.net.evil.com')).toBe('Server');
    expect(guessType('https://jira')).toBeNull();
    expect(guessType('')).toBeNull();
  });

  it('switches to Server with a token only when a company address is typed', () => {
    render(panel());
    expect(radio('Cloud').checked).toBe(true);

    fireEvent.change(address(), { target: { value: 'https://jira.company.com' } });

    expect(radio('Server / Data Center').checked).toBe(true);
    expect(radio('Token').checked).toBe(true);
    expect(screen.getByLabelText('Personal access token')).toBeTruthy();
    expect(screen.queryByLabelText('Atlassian email')).toBeNull();
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.queryByRole('link', { name: /Create an API token/ })).toBeNull();
    expect(screen.getByText(/personal access token in your Jira profile/)).toBeTruthy();
  });

  it('starts Server on the configured sign-in', () => {
    render(panel({ defaultServerAuthScheme: 'Basic' }));

    fireEvent.click(radio('Server / Data Center'));

    expect(radio('Username and password').checked).toBe(true);
    expect(screen.getByLabelText('Username')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Password').type).toBe('password');
    expect(screen.getByText(/Your Jira password gives this app/)).toBeTruthy();
  });

  it('never lets the address override a type chosen by hand', () => {
    render(panel());
    fireEvent.click(radio('Server / Data Center'));
    fireEvent.click(radio('Username and password'));

    fireEvent.change(address(), { target: { value: 'https://other.atlassian.net' } });

    expect(radio('Server / Data Center').checked).toBe(true);
    expect(radio('Username and password').checked).toBe(true);
  });

  it('sends a Server token without a login and needs only the token', async () => {
    const fetchMock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const onConnected = vi.fn();
    render(panel({ onConnected, defaultSiteUrl: 'https://jira.company.com' }));
    const secret = screen.getByLabelText<HTMLInputElement>('Personal access token');
    expect(connect().disabled).toBe(true);

    fireEvent.change(secret, { target: { value: 'server-token' } });
    fireEvent.click(connect());

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('Ada L'));
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      siteUrl: 'https://jira.company.com',
      deployment: 'Server',
      authScheme: 'Bearer',
      login: null,
      secret: 'server-token',
    });
  });

  it('sends a Server username and password', async () => {
    const fetchMock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    render(panel({ defaultSiteUrl: 'https://jira.company.com' }));
    fireEvent.click(radio('Username and password'));

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: ' dev ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(connect());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({ deployment: 'Server', authScheme: 'Basic', login: 'dev', secret: 'pw' });
  });

  it('remembers the type and sign-in per address, and no secret', async () => {
    stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const { unmount } = render(panel({ defaultSiteUrl: 'https://jira.company.com' }));
    fireEvent.click(radio('Username and password'));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'dev-login' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
    fireEvent.click(connect());
    await waitFor(() => expect(window.localStorage.getItem(CONNECTIONS_KEY)).not.toBeNull());
    unmount();

    // Next time: the company address comes back with its own choice, and a Cloud site still gets Cloud.
    render(panel());
    expect(address().value).toBe('https://jira.company.com');
    expect(radio('Username and password').checked).toBe(true);
    fireEvent.change(address(), { target: { value: 'https://example.atlassian.net' } });
    expect(radio('Cloud').checked).toBe(true);
    fireEvent.change(address(), { target: { value: 'https://JIRA.company.com/' } });
    expect(radio('Username and password').checked).toBe(true);

    const stored = JSON.stringify(Object.entries(window.localStorage));
    expect(stored).not.toContain('secret-password');
    expect(stored).not.toContain('dev-login');
  });

  it('on a Server sign-in failure names what was sent and the other choice', async () => {
    stubJiraFetch({ 'POST /api/jira/session': () => problem(401, 'jira_auth_denied', { detail: 'Check the username and password, or the token.' }) });
    render(panel({ defaultSiteUrl: 'https://jira.company.com' }));
    fireEvent.click(radio('Username and password'));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'dev' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });

    fireEvent.click(connect());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('did not accept this username and password');
    expect(alert.textContent).toContain('"Token"');
    expect(alert.textContent).not.toContain('without scopes');
  });

  it('starts from the status type when nothing is remembered and nothing can be guessed', () => {
    render(panel({ defaultSiteUrl: null, deployment: 'Server', authScheme: 'Basic', defaultServerAuthScheme: 'Bearer' }));

    expect(radio('Server / Data Center').checked).toBe(true);
    expect(radio('Username and password').checked).toBe(true);
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

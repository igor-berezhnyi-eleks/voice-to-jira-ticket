import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectPanel } from './ConnectPanel';
import { bodyOf, jsonResponse, problem, stubJiraFetch } from './fakeJira';

const email = () => screen.getByLabelText<HTMLInputElement>('Atlassian email');
const token = () => screen.getByLabelText<HTMLInputElement>('API token');
const connect = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Connect' });

function fill() {
  fireEvent.change(email(), { target: { value: 'me@example.com' } });
  fireEvent.change(token(), { target: { value: 'secret-token' } });
}

describe('ConnectPanel', () => {
  it('has a password token field without autocomplete, a token page link, the notice and Cancel', () => {
    render(<ConnectPanel onConnected={() => undefined} onCancel={() => undefined} />);

    expect(token().type).toBe('password');
    expect(token().getAttribute('autocomplete')).toBe('off');
    const link = screen.getByRole('link', { name: /Create an API token/ });
    expect(link.getAttribute('href')).toBe('https://id.atlassian.com/manage-profile/security/api-tokens');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/same rights as you in Jira/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('keeps Connect disabled until both fields are filled', () => {
    render(<ConnectPanel onConnected={() => undefined} onCancel={() => undefined} />);
    expect(connect().disabled).toBe(true);
    fireEvent.change(email(), { target: { value: 'me@example.com' } });
    expect(connect().disabled).toBe(true);
    fireEvent.change(token(), { target: { value: 'x' } });
    expect(connect().disabled).toBe(false);
  });

  it('posts the credentials, reports the display name and clears the token', async () => {
    const fetchMock = stubJiraFetch({ 'POST /api/jira/session': () => jsonResponse({ displayName: 'Ada L' }) });
    const onConnected = vi.fn();
    render(<ConnectPanel onConnected={onConnected} onCancel={() => undefined} />);
    fill();

    fireEvent.click(connect());

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('Ada L'));
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ email: 'me@example.com', apiToken: 'secret-token' });
    expect(token().value).toBe('');
  });

  it('shows the scopes hint on jira_auth_denied and clears the token', async () => {
    stubJiraFetch({ 'POST /api/jira/session': () => problem(401, 'jira_auth_denied') });
    const onConnected = vi.fn();
    render(<ConnectPanel onConnected={onConnected} onCancel={() => undefined} />);
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
    render(<ConnectPanel onConnected={() => undefined} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

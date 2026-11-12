import { useEffect, useRef, useState, type FormEvent } from 'react';
import { connectJira } from './jiraApi';
import { describeJiraError } from './jiraErrorMessages';

export const API_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

interface ConnectPanelProps {
  onConnected: (displayName: string) => void;
  onCancel: () => void;
  /** Shown above the form, for example "Your Jira session has ended." */
  reason?: string;
}

export function ConnectPanel({ onConnected, onCancel, reason }: ConnectPanelProps) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setRunning(true);
    try {
      const name = await connectJira(email.trim(), token, controller.signal);
      setToken('');
      onConnected(name);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setToken('');
      setError(describeJiraError(failure, 'connect').message);
      setRunning(false);
    }
  }

  return (
    <form className="connect-panel" onSubmit={(event) => void submit(event)} aria-label="Connect to Jira">
      <h2>Connect to Jira</h2>
      {reason && <p role="status">{reason}</p>}
      <p className="hint">
        The token gives this app the same rights as you in Jira. It is kept only in an encrypted browser cookie for this app,
        Disconnect removes it, and you can revoke it any time in your Atlassian account.{' '}
        <a href={API_TOKEN_URL} target="_blank" rel="noopener noreferrer">
          Create an API token (without scopes)
        </a>
      </p>
      <div className="field">
        <label htmlFor="jira-email">Atlassian email</label>
        <input id="jira-email" type="text" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="jira-token">API token</label>
        <input id="jira-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" disabled={running || email.trim() === '' || token === ''}>
          Connect
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

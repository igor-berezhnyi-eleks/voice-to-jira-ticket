import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Link, Stack, TextField, Typography } from '@eleks-ui/components';
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
    <form onSubmit={(event) => void submit(event)} aria-label="Connect to Jira">
      <Typography component="h2" variant="h6" sx={{ fontWeight: 600 }}>
        Connect to Jira
      </Typography>
      {reason && (
        <Alert severity="info" role="status" sx={{ mt: 1 }}>
          {reason}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        The token gives this app the same rights as you in Jira. It is kept only in an encrypted browser cookie for this app,
        Disconnect removes it, and you can revoke it any time in your Atlassian account.{' '}
        <Link href={API_TOKEN_URL} target="_blank" rel="noopener noreferrer">
          Create an API token (without scopes)
        </Link>
      </Typography>
      <Stack spacing={2}>
        <TextField
          id="jira-email"
          label="Atlassian email"
          type="text"
          autoComplete="off"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="jira-token"
          label="API token"
          type="password"
          autoComplete="off"
          fullWidth
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button variant="text" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={running || email.trim() === '' || token === ''}>
            Connect
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

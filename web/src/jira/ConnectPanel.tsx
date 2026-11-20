import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, FormControlLabel, Link, Radio, RadioGroup, Stack, TextField, Typography } from '@eleks-ui/components';
import { useT } from '../i18n/LanguageProvider';
import { connectJira, JiraApiError } from './jiraApi';
import { describeJiraError } from './jiraErrorMessages';

export const API_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

/** The last Jira address that connected, kept in this browser. The address only: no email, no token. */
export const SITE_URL_KEY = 'vtt.jira.siteUrl';

/** The Jira type and sign-in last used for each address that connected. No login, no secret. */
export const CONNECTIONS_KEY = 'vtt.jira.connections';

export type JiraType = 'Cloud' | 'Server';
export type SignIn = 'Bearer' | 'Basic';

interface Connection {
  deployment: JiraType;
  authScheme: SignIn;
}

const asType = (value: unknown): JiraType | null => (value === 'Cloud' || value === 'Server' ? value : null);
const asSignIn = (value: unknown): SignIn | null => (value === 'Bearer' || value === 'Basic' ? value : null);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the address and choices are then entered again next time.
  }
}

function readConnections(): Record<string, Connection> {
  try {
    const parsed: unknown = JSON.parse(readStored(CONNECTIONS_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<string, Connection> = {};
    for (const [address, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      const deployment = asType(entry.deployment);
      const authScheme = asSignIn(entry.authScheme);
      if (deployment && authScheme) result[address] = { deployment, authScheme };
    }
    return result;
  } catch {
    return {};
  }
}

/** The key an address is remembered under: lower case, no trailing slash, so small typing differences match. */
function addressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\/+$/, '');
}

function rememberConnection(address: string, connection: Connection) {
  writeStored(SITE_URL_KEY, address);
  writeStored(CONNECTIONS_KEY, JSON.stringify({ ...readConnections(), [addressKey(address)]: connection }));
}

/**
 * Guesses the type from the address: a host ending in `.atlassian.net` is Cloud, any other complete host is Server.
 * Null while the host is still incomplete. The server never uses the guess; the user can always change it.
 */
export function guessType(address: string): JiraType | null {
  const trimmed = address.trim();
  if (trimmed === '') return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith('.atlassian.net')) return 'Cloud';
  return host.includes('.') && !host.endsWith('.') ? 'Server' : null;
}

interface ConnectPanelProps {
  /** The server's default address (`Jira:BaseUrl`), shown until the user has connected somewhere else. */
  defaultSiteUrl: string | null;
  /** The host patterns the server accepts, listed as a hint. */
  allowedHosts: string[];
  /** From status: the type of the last session, or `Jira:Deployment`. Used when nothing is remembered and nothing can be guessed. */
  deployment: string;
  /** From status: the sign-in that goes with `deployment`. */
  authScheme: string;
  /** From status: `Jira:ServerAuthScheme`, the sign-in to start with when the user picks Server. */
  defaultServerAuthScheme: string;
  onConnected: (displayName: string) => void;
  onCancel: () => void;
  /** Shown above the form, for example "Your Jira session has ended." */
  reason?: string;
}

export function ConnectPanel({
  defaultSiteUrl,
  allowedHosts,
  deployment,
  authScheme,
  defaultServerAuthScheme,
  onConnected,
  onCancel,
  reason,
}: ConnectPanelProps) {
  const t = useT();
  const c = t.connect;
  const serverDefault: SignIn = asSignIn(defaultServerAuthScheme) ?? 'Bearer';
  const signInFor = (type: JiraType): SignIn => (type === 'Cloud' ? 'Basic' : serverDefault);

  // Remembered for this address, else guessed from it, else what the server says.
  function choiceFor(address: string): Connection | null {
    const remembered = readConnections()[addressKey(address)];
    if (remembered) return remembered;
    const guessed = guessType(address);
    return guessed ? { deployment: guessed, authScheme: signInFor(guessed) } : null;
  }

  const [siteUrl, setSiteUrl] = useState(() => readStored(SITE_URL_KEY) ?? defaultSiteUrl ?? '');
  const [connection, setConnection] = useState<Connection>(() => {
    const fromStatus = asType(deployment) ?? 'Cloud';
    const statusChoice = { deployment: fromStatus, authScheme: fromStatus === 'Cloud' ? 'Basic' : (asSignIn(authScheme) ?? serverDefault) } as Connection;
    return choiceFor(readStored(SITE_URL_KEY) ?? defaultSiteUrl ?? '') ?? statusChoice;
  });
  /** Set once the user picks the type or the sign-in by hand: from then on the address no longer changes them. */
  const [chosenByHand, setChosenByHand] = useState(false);
  const [login, setLogin] = useState('');
  const [secret, setSecret] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const isServer = connection.deployment === 'Server';
  const bearer = isServer && connection.authScheme === 'Bearer';
  const loginLabel = isServer ? c.username : c.atlassianEmail;
  const secretLabel = !isServer ? c.apiToken : bearer ? c.personalAccessToken : c.password;

  function changeAddress(address: string) {
    setSiteUrl(address);
    if (chosenByHand) return;
    const choice = choiceFor(address);
    if (choice) setConnection(choice);
  }

  function changeType(type: JiraType) {
    setChosenByHand(true);
    setConnection({ deployment: type, authScheme: signInFor(type) });
    setError(null);
  }

  function changeSignIn(signIn: SignIn) {
    setChosenByHand(true);
    setConnection({ deployment: 'Server', authScheme: signIn });
    setError(null);
  }

  function describe(failure: unknown): string {
    // The general message names an email and an API token: on Server say what was really sent, and how to change it.
    if (isServer && failure instanceof JiraApiError && failure.code === 'jira_auth_denied') {
      return c.serverDenied(bearer, failure.message);
    }
    return describeJiraError(failure, 'connect', t).message;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setRunning(true);
    try {
      const address = siteUrl.trim();
      const name = await connectJira(
        { siteUrl: address, deployment: connection.deployment, authScheme: connection.authScheme, login: bearer ? null : login.trim(), secret },
        controller.signal,
      );
      rememberConnection(address, connection);
      setSecret('');
      onConnected(name);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setSecret('');
      setError(describe(failure));
      setRunning(false);
    }
  }

  const missing = siteUrl.trim() === '' || secret === '' || (!bearer && login.trim() === '');

  return (
    <form onSubmit={(event) => void submit(event)} aria-label={c.title}>
      <Typography component="h2" variant="h6" sx={{ fontWeight: 600 }}>
        {c.title}
      </Typography>
      {reason && (
        <Alert severity="info" role="status" sx={{ mt: 1 }}>
          {reason}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {!isServer && (
          <>
            {c.cloudNotice}{' '}
            <Link href={API_TOKEN_URL} target="_blank" rel="noopener noreferrer">
              {c.createToken}
            </Link>
          </>
        )}
        {bearer && c.tokenNotice}
        {isServer && !bearer && c.passwordNotice}
      </Typography>
      <Stack spacing={2}>
        <TextField
          id="jira-address"
          label={c.address}
          type="text"
          autoComplete="off"
          fullWidth
          value={siteUrl}
          onChange={(e) => changeAddress(e.target.value)}
          helperText={allowedHosts.length > 0 ? c.allowed(allowedHosts.join(', ')) : undefined}
        />
        <RadioGroup row aria-label={c.typeGroup} value={connection.deployment} onChange={(event) => changeType(event.target.value as JiraType)}>
          <FormControlLabel value="Cloud" control={<Radio />} label={c.cloud} />
          <FormControlLabel value="Server" control={<Radio />} label={c.server} />
        </RadioGroup>
        {isServer && (
          <RadioGroup row aria-label={c.signInWith} value={connection.authScheme} onChange={(event) => changeSignIn(event.target.value as SignIn)}>
            <FormControlLabel value="Bearer" control={<Radio />} label={c.token} />
            <FormControlLabel value="Basic" control={<Radio />} label={c.usernameAndPassword} />
          </RadioGroup>
        )}
        {!bearer && (
          <TextField
            id="jira-login"
            label={loginLabel}
            type="text"
            autoComplete="off"
            fullWidth
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        )}
        <TextField
          id="jira-secret"
          label={secretLabel}
          type="password"
          autoComplete="off"
          fullWidth
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button variant="text" onClick={onCancel}>
            {c.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={running || missing}>
            {c.connect}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectPanel } from './ConnectPanel';
import { IssueSearch } from './IssueSearch';
import { JiraFieldsArea, blockingFields } from './JiraFieldsArea';
import {
  createIssue,
  disconnectJira,
  getFields,
  getIssueTypes,
  getProjects,
  type CreateIssueResponse,
  type JiraFieldsResponse,
  type JiraIssueHit,
  type JiraIssueType,
  type JiraProject,
  type JiraStatus,
} from './jiraApi';
import { JiraApiError } from './jiraApi';
import { describeJiraError, type JiraErrorDescription } from './jiraErrorMessages';

interface CreateInJiraPageProps {
  /** Page 2's title and the Jira wiki text Copy would copy. */
  summary: string;
  description: string;
  ticketType: 'Bug' | 'Feature';
  status: JiraStatus;
  onBack: () => void;
}

interface Rejection {
  fieldErrors: Record<string, string>;
  messages: string[];
}

const SESSION_ENDED = 'Your Jira session has ended. Connect again; your entries are kept.';

export function CreateInJiraPage({ summary: initialSummary, description: initialDescription, ticketType, status, onBack }: CreateInJiraPageProps) {
  const [connected, setConnected] = useState(status.connected);
  const [displayName, setDisplayName] = useState(status.displayName ?? '');
  const [sessionEnded, setSessionEnded] = useState(false);

  const [summary, setSummary] = useState(initialSummary);
  const [description, setDescription] = useState(initialDescription);

  const [projects, setProjects] = useState<JiraProject[] | null>(null);
  const [projectKey, setProjectKey] = useState('');
  // Results are stored with the choice they were loaded for and read only while it is still the current one,
  // so a changed project or type never shows the old answer (and no effect has to reset state).
  const [typesState, setTypesState] = useState<{ projectKey: string; list: JiraIssueType[] } | null>(null);
  const [typeId, setTypeId] = useState('');
  const [fieldsState, setFieldsState] = useState<{ key: string; data: JiraFieldsResponse } | null>(null);
  const [parentState, setParentState] = useState<{ key: string; hit: JiraIssueHit } | null>(null);
  const types = typesState?.projectKey === projectKey ? typesState.list : null;
  const choiceKey = `${projectKey}/${typeId}`;
  const fieldsInfo = fieldsState?.key === choiceKey ? fieldsState.data : null;
  const parent = parentState?.key === choiceKey ? parentState.hit : null;
  const setParent = (hit: JiraIssueHit | null) => setParentState(hit ? { key: choiceKey, hit } : null);

  const [loadError, setLoadError] = useState<JiraErrorDescription | null>(null);
  const [reload, setReload] = useState(0);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<JiraErrorDescription | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [result, setResult] = useState<CreateIssueResponse | null>(null);
  const creatingRef = useRef(false);
  const createRequest = useRef<AbortController | null>(null);
  useEffect(() => () => createRequest.current?.abort(), []);

  const handleFailure = useCallback((failure: unknown, action: 'load' | 'create'): JiraErrorDescription => {
    const description = describeJiraError(failure, action);
    if (description.authRequired) {
      setConnected(false);
      setSessionEnded(true);
    }
    return description;
  }, []);

  // Projects. The configured default is preselected only while nothing is chosen.
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    getProjects(controller.signal)
      .then((list) => {
        setProjects(list);
        setProjectKey((current) =>
          current !== '' ? current : list.some((p) => p.key === status.defaultProjectKey) ? (status.defaultProjectKey ?? '') : '',
        );
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, reload, status.defaultProjectKey, handleFailure]);

  // Issue types of the chosen project, with the suggested one preselected.
  useEffect(() => {
    if (!connected || projectKey === '') return;
    const controller = new AbortController();
    getIssueTypes(projectKey, controller.signal)
      .then((list) => {
        setTypesState({ projectKey, list });
        setTypeId((current) => {
          if (list.some((t) => t.id === current)) return current;
          return (list.find((t) => t.suggestedFor.includes(ticketType)) ?? list[0])?.id ?? '';
        });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, projectKey, reload, ticketType, handleFailure]);

  // Fields and parent types of the chosen issue type.
  useEffect(() => {
    if (!connected || projectKey === '' || typeId === '' || !types?.some((t) => t.id === typeId)) return;
    const controller = new AbortController();
    getFields(projectKey, typeId, controller.signal)
      .then((data) => setFieldsState({ key: `${projectKey}/${typeId}`, data }))
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, projectKey, typeId, types, reload, handleFailure]);

  async function create() {
    if (creatingRef.current || !fieldsInfo) return;
    creatingRef.current = true;
    const controller = new AbortController();
    createRequest.current = controller;
    setCreating(true);
    setCreateError(null);
    setRejection(null);
    try {
      setResult(
        await createIssue(
          {
            projectKey,
            issueTypeId: typeId,
            summary: summary.trim(),
            description,
            parentKey: parent?.key ?? null,
            fields: {},
            links: [],
          },
          controller.signal,
        ),
      );
    } catch (failure) {
      if (controller.signal.aborted) return;
      const described = handleFailure(failure, 'create');
      // An expired session shows the Connect panel instead of an error on the form.
      if (!described.authRequired) setCreateError(described);
      if (failure instanceof JiraApiError && failure.code === 'jira_rejected') {
        setRejection({ fieldErrors: failure.fieldErrors, messages: failure.messages });
      }
    } finally {
      creatingRef.current = false;
      if (!controller.signal.aborted) setCreating(false);
    }
  }

  async function disconnect() {
    try {
      await disconnectJira(new AbortController().signal);
    } catch {
      // The cookie may already be gone; either way the panel is shown.
    }
    setConnected(false);
    setSessionEnded(false);
  }

  function createAnother() {
    setResult(null);
    setCreateError(null);
    setRejection(null);
  }

  function resetToPreview() {
    setSummary(initialSummary);
    setDescription(initialDescription);
  }

  if (!connected) {
    return (
      <ConnectPanel
        reason={sessionEnded ? SESSION_ENDED : undefined}
        onCancel={onBack}
        onConnected={(name) => {
          setDisplayName(name);
          setLoadError(null);
          setSessionEnded(false);
          setConnected(true);
        }}
      />
    );
  }

  const blocked = fieldsInfo ? blockingFields(fieldsInfo.fields).length > 0 : true;
  const canCreate = !creating && summary.trim() !== '' && projectKey !== '' && typeId !== '' && !blocked && result === null;
  const otherFieldErrors = Object.entries(rejection?.fieldErrors ?? {}).filter(([id]) => id !== 'summary' && id !== 'description');
  const pageMessages = [...(rejection?.messages ?? []), ...otherFieldErrors.map(([id, message]) => `${id}: ${message}`)];

  return (
    <>
      <div className="actions">
        <button type="button" onClick={onBack}>
          Back to ticket
        </button>
        <button type="button" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>
      <h1>Create in Jira</h1>
      <p className="hint">Connected as {displayName}</p>

      {loadError && (
        <div className="error-row">
          <p role="alert" className="error">
            {loadError.message}
          </p>
          {loadError.retryable && (
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setReload((n) => n + 1);
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="jira-project">Project</label>
        {projects === null ? (
          !loadError && <p role="status">Loading projects…</p>
        ) : (
          <select id="jira-project" value={projectKey} onChange={(e) => setProjectKey(e.target.value)}>
            <option value="">Choose a project</option>
            {projects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        )}
      </div>

      {projectKey !== '' && types === null && !loadError && <p role="status">Loading issue types…</p>}
      {types !== null && types.length === 0 && <p role="status">This project has no issue types you can create here.</p>}
      {types !== null && types.length > 0 && (
        <div className="field">
          <label htmlFor="jira-type">Issue type</label>
          <select id="jira-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {types !== null && types.length > 0 && fieldsInfo === null && !loadError && <p role="status">Loading fields…</p>}

      <div className="field">
        <label htmlFor="jira-summary">Summary</label>
        <input id="jira-summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} />
        {rejection?.fieldErrors.summary && (
          <p role="alert" className="error">
            {rejection.fieldErrors.summary}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="jira-description">Description</label>
        <textarea id="jira-description" rows={12} value={description} onChange={(e) => setDescription(e.target.value)} />
        {rejection?.fieldErrors.description && (
          <p role="alert" className="error">
            {rejection.fieldErrors.description}
          </p>
        )}
        <button type="button" onClick={resetToPreview}>
          Reset to preview
        </button>
      </div>

      {fieldsInfo && <JiraFieldsArea fields={fieldsInfo.fields} />}

      {fieldsInfo && fieldsInfo.parentTypeIds.length > 0 && (
        <div className="field">
          <span className="label">Parent</span>
          {parent ? (
            <p>
              {parent.key} {parent.summary}{' '}
              <button type="button" onClick={() => setParent(null)}>
                No parent
              </button>
            </p>
          ) : (
            <>
              <p className="hint">No parent</p>
              <IssueSearch
                label="Search for a parent"
                projectKey={projectKey}
                issueTypeIds={fieldsInfo.parentTypeIds}
                onPick={setParent}
                onAuthRequired={() => {
                  setConnected(false);
                  setSessionEnded(true);
                }}
              />
            </>
          )}
        </div>
      )}

      {createError && (
        <div role="alert" className="error">
          <p>{createError.message}</p>
          {pageMessages.length > 0 && (
            <ul>
              {pageMessages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result ? (
        <section role="status" aria-label="Created">
          <p>
            Created{' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.key}
            </a>
          </p>
          {result.warnings.map((warning, index) => (
            <p key={index} className="notice">
              {warning.code === 'jira_link_failed'
                ? `Created ${result.key}, but the link to ${warning.issueKey} failed; add it in Jira.`
                : `Jira reported a problem (${warning.code}).`}
            </p>
          ))}
          <button type="button" onClick={createAnother}>
            Create another
          </button>
        </section>
      ) : (
        <div className="actions">
          <button type="button" disabled={!canCreate} onClick={() => void create()}>
            Create issue
          </button>
          {creating && <span role="status">Creating…</span>}
        </div>
      )}
    </>
  );
}

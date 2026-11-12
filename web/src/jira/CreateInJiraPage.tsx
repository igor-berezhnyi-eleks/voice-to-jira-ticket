import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectPanel } from './ConnectPanel';
import { FieldsSection } from './FieldsSection';
import { IssueSearch } from './IssueSearch';
import { LinksSection, defaultLinkType, type LinkDirection, type LinkDraft } from './LinksSection';
import { PreferenceStore } from './jiraPreferences';
import {
  addableFields,
  blockingFields,
  isFilled,
  isSupportedKind,
  toFieldValue,
  type FieldDraft,
} from './fieldValues';
import {
  createIssue,
  disconnectJira,
  getFields,
  getIssueTypes,
  getLinkTypes,
  getProjects,
  type CreateIssueRequest,
  type CreateIssueResponse,
  type JiraField,
  type JiraFieldsResponse,
  type JiraIssueHit,
  type JiraIssueType,
  type JiraLinkType,
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

/** What the user entered for the fields of the shown issue type, and the note about values that were dropped. */
interface Drafts {
  values: Record<string, FieldDraft>;
  /** Optional fields the user added (or that were remembered for the project). */
  added: string[];
  notice: string | null;
}

const SESSION_ENDED = 'Your Jira session has ended. Connect again; your entries are kept.';

const hasContent = (draft: FieldDraft): boolean => (Array.isArray(draft) ? draft.length > 0 : draft.trim() !== '');

const allowedIds = (field: JiraField): Set<string> => new Set((field.allowedValues ?? []).map((v) => v.id));

/**
 * Applies a newly loaded field list to what the user entered: values and added fields of fields the
 * new type also has (same `fieldId`) are kept, the others are dropped and named in the notice.
 */
function pruneDrafts(previous: Drafts, fields: JiraField[], oldFields: JiraField[], remembered: string[]): Drafts {
  const byId = new Map(fields.map((field) => [field.fieldId, field]));
  const nameOf = (id: string) => oldFields.find((field) => field.fieldId === id)?.name ?? byId.get(id)?.name ?? id;
  const dropped = new Set<string>();

  const values: Record<string, FieldDraft> = {};
  for (const [id, draft] of Object.entries(previous.values)) {
    const field = byId.get(id);
    if (!field || !isSupportedKind(field.kind)) {
      if (hasContent(draft)) dropped.add(nameOf(id));
      continue;
    }
    const list = field.kind === 'options' || field.kind === 'labels';
    if (Array.isArray(draft) !== list) {
      if (hasContent(draft)) dropped.add(nameOf(id));
      continue;
    }
    if (field.kind === 'option' && typeof draft === 'string' && draft !== '' && !allowedIds(field).has(draft)) {
      dropped.add(nameOf(id));
      continue;
    }
    if (field.kind === 'options' && Array.isArray(draft)) {
      const allowed = allowedIds(field);
      const kept = draft.filter((id) => allowed.has(id));
      if (kept.length !== draft.length) dropped.add(nameOf(id));
      values[id] = kept;
      continue;
    }
    values[id] = draft;
  }

  const offered = new Set(addableFields(fields).map((field) => field.fieldId));
  const added: string[] = [];
  for (const id of previous.added) {
    if (offered.has(id)) added.push(id);
    else if (!byId.has(id) || byId.get(id)?.kind === 'unsupported') dropped.add(nameOf(id));
  }
  for (const id of remembered) if (offered.has(id) && !added.includes(id)) added.push(id);

  const notice =
    dropped.size > 0 ? `Dropped what you entered for ${[...dropped].join(', ')}: the new issue type does not have it or does not allow the value.` : null;
  return { values, added, notice };
}

export function CreateInJiraPage({ summary: initialSummary, description: initialDescription, ticketType, status, onBack }: CreateInJiraPageProps) {
  const [connected, setConnected] = useState(status.connected);
  const [displayName, setDisplayName] = useState(status.displayName ?? '');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [prefs] = useState(() => new PreferenceStore());
  const [forgotten, setForgotten] = useState(false);

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

  const [drafts, setDrafts] = useState<Drafts>({ values: {}, added: [], notice: null });
  const loadedFields = useRef<JiraField[]>([]);

  const [links, setLinks] = useState<LinkDraft[]>([]);
  const nextLinkId = useRef(1);
  const [linkTypes, setLinkTypes] = useState<JiraLinkType[] | null>(null);
  const [linkTypesLoading, setLinkTypesLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkRequest = useRef<AbortController | null>(null);

  const [loadError, setLoadError] = useState<JiraErrorDescription | null>(null);
  const [reload, setReload] = useState(0);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<JiraErrorDescription | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [result, setResult] = useState<CreateIssueResponse | null>(null);
  const creatingRef = useRef(false);
  const createRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      createRequest.current?.abort();
      linkRequest.current?.abort();
    },
    [],
  );

  const sessionLost = useCallback(() => {
    setConnected(false);
    setSessionEnded(true);
  }, []);

  const handleFailure = useCallback(
    (failure: unknown, action: 'load' | 'create'): JiraErrorDescription => {
      const description = describeJiraError(failure, action);
      if (description.authRequired) sessionLost();
      return description;
    },
    [sessionLost],
  );

  // Projects. The remembered project wins, then the configured default; either is chosen only while nothing is.
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    getProjects(controller.signal)
      .then((list) => {
        setProjects(list);
        setProjectKey((current) => {
          if (current !== '') return current;
          const remembered = prefs.lastProject();
          if (remembered && list.some((p) => p.key === remembered)) return remembered;
          return list.some((p) => p.key === status.defaultProjectKey) ? (status.defaultProjectKey ?? '') : '';
        });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, reload, status.defaultProjectKey, handleFailure, prefs]);

  // Issue types of the chosen project: the remembered one for this ticket type, else the suggested one.
  useEffect(() => {
    if (!connected || projectKey === '') return;
    const controller = new AbortController();
    getIssueTypes(projectKey, controller.signal)
      .then((list) => {
        setTypesState({ projectKey, list });
        setTypeId((current) => {
          if (list.some((t) => t.id === current)) return current;
          const remembered = prefs.issueType(projectKey, ticketType);
          if (remembered && list.some((t) => t.id === remembered)) return remembered;
          return (list.find((t) => t.suggestedFor.includes(ticketType)) ?? list[0])?.id ?? '';
        });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, projectKey, reload, ticketType, handleFailure, prefs]);

  // Fields and parent types of the chosen issue type; what the user entered is carried over where it still fits.
  useEffect(() => {
    if (!connected || projectKey === '' || typeId === '' || !types?.some((t) => t.id === typeId)) return;
    const controller = new AbortController();
    getFields(projectKey, typeId, controller.signal)
      .then((data) => {
        const oldFields = loadedFields.current;
        loadedFields.current = data.fields;
        setFieldsState({ key: `${projectKey}/${typeId}`, data });
        setDrafts((previous) => pruneDrafts(previous, data.fields, oldFields, prefs.fields(projectKey)));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(handleFailure(failure, 'load'));
      });
    return () => controller.abort();
  }, [connected, projectKey, typeId, types, reload, handleFailure, prefs]);

  const required = fieldsInfo ? blockingFields(fieldsInfo.fields) : [];
  const fillable = required.filter((field) => isSupportedKind(field.kind));
  const unfillable = required.filter((field) => !isSupportedKind(field.kind));
  const shownOptional = fieldsInfo ? drafts.added.flatMap((id) => fieldsInfo.fields.filter((field) => field.fieldId === id)) : [];
  const shownFields = [...fillable, ...shownOptional];

  function changeProject(key: string) {
    setProjectKey(key);
    // The new project has its own types; the remembered or suggested one is chosen when they load.
    setTypeId('');
    if (key !== '') prefs.setProject(key);
  }

  function changeType(id: string) {
    setTypeId(id);
    prefs.setIssueType(projectKey, ticketType, id);
  }

  function changeField(fieldId: string, value: FieldDraft) {
    setDrafts((previous) => ({ ...previous, values: { ...previous.values, [fieldId]: value } }));
  }

  function addField(fieldId: string) {
    const added = [...drafts.added.filter((id) => id !== fieldId), fieldId];
    setDrafts((previous) => ({ ...previous, added }));
    prefs.setFields(projectKey, added);
  }

  function removeField(fieldId: string) {
    const added = drafts.added.filter((id) => id !== fieldId);
    setDrafts((previous) => ({
      ...previous,
      values: Object.fromEntries(Object.entries(previous.values).filter(([id]) => id !== fieldId)),
      added,
    }));
    prefs.setFields(projectKey, added);
  }

  async function addLink() {
    let types = linkTypes;
    if (types === null) {
      const controller = new AbortController();
      linkRequest.current = controller;
      setLinkTypesLoading(true);
      setLinkError(null);
      try {
        types = await getLinkTypes(controller.signal);
        setLinkTypes(types);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setLinkError(handleFailure(failure, 'load').message);
        return;
      } finally {
        if (!controller.signal.aborted) setLinkTypesLoading(false);
      }
    }
    if (types.length === 0) {
      setLinkError('This Jira site has no link types.');
      return;
    }
    const typeName = defaultLinkType(types, prefs.linkType(projectKey));
    setLinks((current) => [...current, { id: nextLinkId.current++, typeName, direction: 'outward', issue: null }]);
  }

  function changeLinkType(id: number, typeName: string, direction: LinkDirection) {
    setLinks((current) => current.map((link) => (link.id === id ? { ...link, typeName, direction } : link)));
    if (projectKey !== '') prefs.setLinkType(projectKey, typeName);
  }

  async function create() {
    if (creatingRef.current || !fieldsInfo) return;
    creatingRef.current = true;
    const controller = new AbortController();
    createRequest.current = controller;
    setCreating(true);
    setCreateError(null);
    setRejection(null);
    const fields: CreateIssueRequest['fields'] = {};
    for (const field of shownFields) {
      const value = toFieldValue(field, drafts.values[field.fieldId]);
      if (value) fields[field.fieldId] = value;
    }
    try {
      setResult(
        await createIssue(
          {
            projectKey,
            issueTypeId: typeId,
            summary: summary.trim(),
            description,
            parentKey: parent?.key ?? null,
            fields,
            links: links.flatMap((link) =>
              link.issue ? [{ typeName: link.typeName, direction: link.direction, issueKey: link.issue.key }] : [],
            ),
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

  const missing = fillable.filter((field) => !isFilled(field, drafts.values[field.fieldId]));
  const reasons: string[] = [];
  if (missing.length > 0) reasons.push(`Fill in the required fields: ${missing.map((field) => field.name).join(', ')}.`);
  if (links.some((link) => link.issue === null)) reasons.push('Pick an issue for each link, or remove the link.');

  const blocked = fieldsInfo === null || unfillable.length > 0 || reasons.length > 0;
  const canCreate = !creating && summary.trim() !== '' && projectKey !== '' && typeId !== '' && !blocked && result === null;

  const shownIds = new Set(shownFields.map((field) => field.fieldId));
  const fieldErrors = Object.fromEntries(Object.entries(rejection?.fieldErrors ?? {}).filter(([id]) => shownIds.has(id)));
  const otherFieldErrors = Object.entries(rejection?.fieldErrors ?? {}).filter(
    ([id]) => id !== 'summary' && id !== 'description' && !shownIds.has(id),
  );
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
          <select id="jira-project" value={projectKey} onChange={(e) => changeProject(e.target.value)}>
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
          <select id="jira-type" value={typeId} onChange={(e) => changeType(e.target.value)}>
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

      {drafts.notice && (
        <p role="status" className="notice">
          {drafts.notice}
        </p>
      )}

      {fieldsInfo && (
        <FieldsSection
          fields={fieldsInfo.fields}
          values={drafts.values}
          added={drafts.added}
          errors={fieldErrors}
          onChange={changeField}
          onAdd={addField}
          onRemove={removeField}
        />
      )}

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
                onAuthRequired={sessionLost}
              />
            </>
          )}
        </div>
      )}

      <LinksSection
        links={links}
        linkTypes={linkTypes}
        loading={linkTypesLoading}
        loadError={linkError}
        onAdd={() => void addLink()}
        onRemove={(id) => setLinks((current) => current.filter((link) => link.id !== id))}
        onChangeType={changeLinkType}
        onPick={(id, issue) => setLinks((current) => current.map((link) => (link.id === id ? { ...link, issue } : link)))}
        onAuthRequired={sessionLost}
      />

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
        <>
          {reasons.length > 0 && (
            <p role="status" className="hint">
              {reasons.join(' ')}
            </p>
          )}
          <div className="actions">
            <button type="button" disabled={!canCreate} onClick={() => void create()}>
              Create issue
            </button>
            {creating && <span role="status">Creating…</span>}
          </div>
        </>
      )}

      <p className="hint">
        <button
          type="button"
          className="link"
          onClick={() => {
            prefs.clear();
            setForgotten(true);
          }}
        >
          Forget my Jira choices
        </button>
        {forgotten && <span role="status"> Remembered choices cleared.</span>}
      </p>
    </>
  );
}

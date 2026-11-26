import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Divider, Link, Stack, TextField, Typography } from '@eleks-ui/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SendIcon from '@mui/icons-material/Send';
import { useT } from '../i18n/LanguageProvider';
import { PageCard } from '../layout/AppShell';
import type { PageNavigation } from '../layout/PageHeader';
import type { Dictionary } from '../i18n/en';
import { NativeSelect } from '../layout/NativeSelect';
import { ConnectPanel } from './ConnectPanel';
import { FieldsSection } from './FieldsSection';
import { fieldName } from './fieldNames';
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
  /** Page 2's title and the Jira wiki text Copy would copy (from Page 1, those of the untouched generated ticket). */
  summary: string;
  description: string;
  /** The generated ticket's type. */
  ticketType: 'Bug' | 'Feature';
  status: JiraStatus;
  /** Back (to Page 2) and the Connect panel's Cancel, after the question when this page has changes. */
  onBack: () => void;
  /** Page 2 has edits that going to Page 1 would lose too. */
  ticketEdits?: boolean;
  /** A header step was clicked (0 Report, 1 Review), after the question when something would be lost. */
  onStep?: (step: number) => void;
  /** Receives the header steps after every render. */
  onNavigation?: (navigation: PageNavigation) => void;
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

const hasContent = (draft: FieldDraft): boolean => (Array.isArray(draft) ? draft.length > 0 : draft.trim() !== '');

const allowedIds = (field: JiraField): Set<string> => new Set((field.allowedValues ?? []).map((v) => v.id));

/**
 * Applies a newly loaded field list to what the user entered: values and added fields of fields the
 * new type also has (same `fieldId`) are kept, the others are dropped and named in the notice.
 */
function pruneDrafts(
  previous: Drafts,
  fields: JiraField[],
  oldFields: JiraField[],
  remembered: string[],
  t: Dictionary,
): Drafts {
  const byId = new Map(fields.map((field) => [field.fieldId, field]));
  const nameOf = (id: string) =>
    fieldName(oldFields.find((field) => field.fieldId === id) ?? byId.get(id) ?? { fieldId: id, name: id }, t);
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

  const notice = dropped.size > 0 ? t.jira.dropped([...dropped].join(', ')) : null;
  return { values, added, notice };
}

export function CreateInJiraPage({
  summary: initialSummary,
  description: initialDescription,
  ticketType,
  status,
  onBack,
  ticketEdits = false,
  onStep,
  onNavigation,
}: CreateInJiraPageProps) {
  const t = useT();
  const j = t.jira;
  // Loads and error texts read the current language through a ref, so a language switch never refetches.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
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

  /** The question asked before leaving: what would be lost, and where the user goes on Continue. */
  const [leaving, setLeaving] = useState<{ message: string; leave: () => void } | null>(null);

  const sessionLost = useCallback(() => {
    setConnected(false);
    setSessionEnded(true);
  }, []);

  const handleFailure = useCallback(
    (failure: unknown, action: 'load' | 'create'): JiraErrorDescription => {
      const description = describeJiraError(failure, action, tRef.current);
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
          const suggested = list.find((t) => t.suggestedFor.includes(ticketType));
          return (suggested ?? list[0])?.id ?? '';
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
        setDrafts((previous) => pruneDrafts(previous, data.fields, oldFields, prefs.fields(projectKey), tRef.current));
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
      setLinkError(j.noLinkTypes);
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

  // Changes are what the user typed or picked for the issue; project and issue type are remembered preferences,
  // the Connect panel has none, and after Create nothing is lost.
  const hasChanges =
    connected &&
    result === null &&
    (summary !== initialSummary ||
      description !== initialDescription ||
      Object.values(drafts.values).some(hasContent) ||
      parent !== null ||
      links.length > 0);

  /** Leaves to `step` (0 Report, 1 Review); asks first when this page's changes or Page 2's edits would be lost. */
  function leave(step: number, go: () => void) {
    const losesTicket = step === 0 && ticketEdits;
    if (!hasChanges && !losesTicket) {
      go();
      return;
    }
    setLeaving({
      message: hasChanges && losesTicket ? j.confirmLeaveBoth : losesTicket ? j.confirmLeaveTicketEdits : j.confirmLeave,
      leave: go,
    });
  }

  const busyReason = creating ? t.stepReasons.busy : undefined;
  const steps = [
    { disabled: creating, reason: busyReason },
    { disabled: creating, reason: busyReason },
    { disabled: false },
  ];
  // A layout effect, so the handler is in place in the same commit that shows the page (no click hits the old one).
  useLayoutEffect(() => {
    onNavigation?.({
      steps,
      go: (step) => {
        if (step < 2 && !steps[step].disabled) leave(step, () => onStep?.(step));
      },
    });
  });

  const leaveQuestion = leaving && (
    <Alert
      severity="warning"
      role="group"
      aria-label={t.ticketPage.confirm}
      sx={{ mb: 2 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button color="inherit" size="small" onClick={leaving.leave}>
            {t.ticketPage.discard}
          </Button>
          <Button color="inherit" size="small" onClick={() => setLeaving(null)}>
            {t.ticketPage.cancel}
          </Button>
        </Stack>
      }
    >
      {leaving.message}
    </Alert>
  );

  if (!connected) {
    return (
      <PageCard>
        {leaveQuestion}
        <ConnectPanel
          defaultSiteUrl={status.defaultSiteUrl}
          allowedHosts={status.allowedHosts}
          deployment={status.deployment}
          authScheme={status.authScheme}
          defaultServerAuthScheme={status.defaultServerAuthScheme}
          reason={sessionEnded ? t.jiraErrors.authRequired : undefined}
          onCancel={onBack}
          onConnected={(name) => {
            setDisplayName(name);
            setLoadError(null);
            setSessionEnded(false);
            setConnected(true);
          }}
        />
      </PageCard>
    );
  }

  const missing = fillable.filter((field) => !isFilled(field, drafts.values[field.fieldId]));
  const reasons: string[] = [];
  if (missing.length > 0) reasons.push(j.fillRequired(missing.map((field) => fieldName(field, t)).join(', ')));
  if (links.some((link) => link.issue === null)) reasons.push(j.pickLinkIssue);

  const blocked = fieldsInfo === null || unfillable.length > 0 || reasons.length > 0;
  const canCreate = !creating && summary.trim() !== '' && projectKey !== '' && typeId !== '' && !blocked && result === null;

  const shownIds = new Set(shownFields.map((field) => field.fieldId));
  const fieldErrors = Object.fromEntries(Object.entries(rejection?.fieldErrors ?? {}).filter(([id]) => shownIds.has(id)));
  const otherFieldErrors = Object.entries(rejection?.fieldErrors ?? {}).filter(
    ([id]) => id !== 'summary' && id !== 'description' && !shownIds.has(id),
  );
  const pageMessages = [...(rejection?.messages ?? []), ...otherFieldErrors.map(([id, message]) => `${fieldName({ fieldId: id, name: id }, t)}: ${message}`)];

  return (
    <PageCard>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => leave(1, onBack)}>
          {j.backToTicket}
        </Button>
        <Button variant="outlined" startIcon={<LinkOffIcon />} onClick={() => void disconnect()}>
          {j.disconnect}
        </Button>
      </Stack>
      {leaveQuestion}
      <Typography component="h1" variant="h6" sx={{ fontWeight: 600 }}>
        {j.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
        {j.connectedAs(displayName)}
      </Typography>

      <Stack spacing={2}>
        {loadError && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Alert severity="error" sx={{ flexGrow: 1 }}>
              {loadError.message}
            </Alert>
            {loadError.retryable && (
              <Button
                variant="outlined"
                onClick={() => {
                  setLoadError(null);
                  setReload((n) => n + 1);
                }}
              >
                {j.tryAgain}
              </Button>
            )}
          </Stack>
        )}

        {projects === null ? (
          !loadError && (
            <Typography variant="body2" role="status">
              {j.loadingProjects}
            </Typography>
          )
        ) : (
          <NativeSelect id="jira-project" label={j.project} value={projectKey} onChange={(e) => changeProject(e.target.value)}>
            <option value="">{j.chooseProject}</option>
            {projects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} ({p.key})
              </option>
            ))}
          </NativeSelect>
        )}

        {projectKey !== '' && types === null && !loadError && (
          <Typography variant="body2" role="status">
            {j.loadingTypes}
          </Typography>
        )}
        {types !== null && types.length === 0 && (
          <Typography variant="body2" role="status">
            {j.noTypes}
          </Typography>
        )}
        {types !== null && types.length > 0 && (
          <NativeSelect id="jira-type" label={j.issueType} value={typeId} onChange={(e) => changeType(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        )}

        {types !== null && types.length > 0 && fieldsInfo === null && !loadError && (
          <Typography variant="body2" role="status">
            {j.loadingFields}
          </Typography>
        )}

        <Divider />

        <Box>
          <TextField id="jira-summary" label={j.summary} fullWidth value={summary} onChange={(e) => setSummary(e.target.value)} />
          {rejection?.fieldErrors.summary && (
            <Typography role="alert" variant="caption" color="error" component="p" sx={{ mt: 0.5 }}>
              {rejection.fieldErrors.summary}
            </Typography>
          )}
        </Box>
        <Box>
          <TextField
            id="jira-description"
            label={j.description}
            multiline
            rows={12}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {rejection?.fieldErrors.description && (
            <Typography role="alert" variant="caption" color="error" component="p" sx={{ mt: 0.5 }}>
              {rejection.fieldErrors.description}
            </Typography>
          )}
          <Button variant="text" size="small" startIcon={<RestartAltIcon />} onClick={resetToPreview} sx={{ mt: 0.5 }}>
            {j.resetToPreview}
          </Button>
        </Box>

        {drafts.notice && (
          <Alert severity="info" role="status">
            {drafts.notice}
          </Alert>
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
          <Box className="field">
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {j.parent}
            </Typography>
            {parent ? (
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2">
                  {parent.key} {parent.summary}
                </Typography>
                <Button variant="text" size="small" onClick={() => setParent(null)}>
                  {j.noParent}
                </Button>
              </Stack>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  {j.noParent}
                </Typography>
                <IssueSearch
                  label={j.searchParent}
                  projectKey={projectKey}
                  issueTypeIds={fieldsInfo.parentTypeIds}
                  onPick={setParent}
                  onAuthRequired={sessionLost}
                />
              </>
            )}
          </Box>
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
          <Alert severity="error" role="alert">
            {createError.message}
            {pageMessages.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                {pageMessages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </Box>
            )}
          </Alert>
        )}

        <Divider />

        {result ? (
          <Alert
            severity="success"
            role="status"
            aria-label={j.created}
            action={
              <Button color="inherit" size="small" onClick={createAnother}>
                {j.createAnother}
              </Button>
            }
          >
            {j.created}{' '}
            <Link href={result.url} target="_blank" rel="noopener noreferrer">
              {result.key}
            </Link>
          </Alert>
        ) : (
          <>
            {reasons.length > 0 && (
              <Typography role="status" variant="body2" color="text.secondary">
                {reasons.join(' ')}
              </Typography>
            )}
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
              {creating && (
                <Typography variant="body2" role="status">
                  {j.creating}
                </Typography>
              )}
              <Button variant="contained" endIcon={<SendIcon />} disabled={!canCreate} onClick={() => void create()}>
                {j.createIssue}
              </Button>
            </Stack>
          </>
        )}
        {result?.warnings.map((warning, index) => (
          <Alert key={index} severity="warning" role="note">
            {warning.code === 'jira_link_failed' ? j.linkFailed(result.key, warning.issueKey) : j.jiraProblem(warning.code)}
          </Alert>
        ))}

        <Typography variant="caption" color="text.secondary">
          <Link
            component="button"
            type="button"
            variant="caption"
            onClick={() => {
              prefs.clear();
              setForgotten(true);
            }}
          >
            {j.forget}
          </Link>
          {forgotten && <span role="status"> {j.forgotten}</span>}
        </Typography>
      </Stack>
    </PageCard>
  );
}

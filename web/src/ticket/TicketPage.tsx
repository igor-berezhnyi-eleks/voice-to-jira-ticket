import { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@eleks-ui/components';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageCard } from '../layout/AppShell';
import { generateTicket, type GenerateTicketResponse, type Ticket } from '../api';
import { convertTicket } from './convertTicket';
import { describeGenerationError, type ErrorDescription } from '../errorMessages';
import { editedTicket } from './editedTicket';
import { hasEdits } from './editState';
import { downloadText, jsonFileName } from './exportFile';
import { controlId, fieldsFor, isFieldOf, type FieldInfo, type FieldPath } from './fieldPaths';
import { addItem, moveItem, removeItem, updateItem } from './listEditing';
import { isNotProvided } from './notProvided';
import { renderJiraWiki } from './render/jiraWiki';
import { JiraWikiView } from './render/JiraWikiView';
import { renderPlain } from './render/plain';

interface TicketPageProps {
  response: GenerateTicketResponse;
  /** The transcript the ticket was generated from; Regenerate sends it again unchanged. */
  transcript: string;
  onBack: () => void;
  onRegenerated: (response: GenerateTicketResponse) => void;
  /** Whether the server has Jira switched on (`GET /api/jira/status`). Absent means off. */
  jiraEnabled?: boolean;
  /** Opens Page 3 with the edited ticket and the Jira wiki text Copy would copy. */
  onConnectJira?: (ticket: Ticket, wikiText: string) => void;
}

const TITLE_HINT_LENGTH = 120;
const COPIED_MS = 2000;

type Format = 'plain' | 'wiki';
type CopyStatus = 'idle' | 'copied' | 'failed';

/** A list item with a stable id, so a row keeps its text and focus when rows above it move or go. */
interface Row {
  id: number;
  text: string;
}

type TicketType = Ticket['type'];
type MissingInformation = Ticket['missingInformation'][number];

/** One type's edit state: text per path, and rows per list path. Held in the browser only. */
interface View {
  texts: Partial<Record<FieldPath, string>>;
  lists: Partial<Record<FieldPath, Row[]>>;
  missing: MissingInformation[];
  /** Set when this view was made by converting the other type in the browser (decision D16). */
  convertedFrom: TicketType | null;
  /** The seeded values read out like an edit, so an untouched view compares equal to it. */
  baseline: Ticket;
}

/** A view that was left by switching type, remembered so switching back restores it. */
interface ParkedView extends View {
  /** Whether it had edits when it was left. */
  dirty: boolean;
}

interface Draft extends View {
  source: GenerateTicketResponse;
  /** The type shown now; the generated ticket's type until the reporter picks the other one. */
  type: TicketType;
  parked: Partial<Record<TicketType, ParkedView>>;
}

let nextRowId = 0;
const newRow = (text: string): Row => ({ id: nextRowId++, text });

function valueAt(ticket: Ticket, path: FieldPath): string | string[] {
  switch (path) {
    case 'title':
      return ticket.title;
    case 'description':
      return ticket.description;
    case 'bug.stepsToReproduce':
      return ticket.bug?.stepsToReproduce ?? [];
    case 'bug.actualResult':
      return ticket.bug?.actualResult ?? '';
    case 'bug.expectedResult':
      return ticket.bug?.expectedResult ?? '';
    case 'bug.environment':
      return ticket.bug?.environment ?? '';
    case 'feature.userNeed':
      return ticket.feature?.userNeed ?? '';
    case 'feature.proposedBehavior':
      return ticket.feature?.proposedBehavior ?? '';
    case 'feature.acceptanceCriteria':
      return ticket.feature?.acceptanceCriteria ?? [];
  }
}

/** The base `editedTicket` reads into: the type and its questions, with no details of the other type. */
function baseFor(type: TicketType, missing: MissingInformation[]): Ticket {
  return { type, title: '', description: '', bug: null, feature: null, missingInformation: missing };
}

function seedView(ticket: Ticket, convertedFrom: TicketType | null): View {
  const texts: View['texts'] = {};
  const lists: View['lists'] = {};
  for (const field of fieldsFor(ticket.type)) {
    const value = valueAt(ticket, field.path);
    if (typeof value === 'string') texts[field.path] = value;
    else lists[field.path] = value.map(newRow);
  }
  const missing = ticket.missingInformation;
  return { texts, lists, missing, convertedFrom, baseline: editedTicket(baseFor(ticket.type, missing), texts, lists) };
}

function seed(response: GenerateTicketResponse): Draft {
  return { ...seedView(response.ticket, null), source: response, type: response.ticket.type, parked: {} };
}

export function TicketPage({ response, transcript, onBack, onRegenerated, jiraEnabled = false, onConnectJira }: TicketPageProps) {
  const [state, setState] = useState(() => seed(response));
  // A new response starts a fresh edit state (adjusting state during render, as React documents).
  const draft = state.source === response ? state : seed(response);
  if (draft !== state) setState(draft);

  const [format, setFormat] = useState<Format>('plain');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = setTimeout(() => setCopyStatus('idle'), copyStatus === 'copied' ? COPIED_MS : COPIED_MS * 3);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const [confirming, setConfirming] = useState<'regenerate' | 'back' | null>(null);
  /** The type the pending or last Regenerate asked for (undefined: let the model decide). Retry repeats it. */
  const [requestedType, setRequestedType] = useState<TicketType | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const { model, durationMs } = response;
  const fields = fieldsFor(draft.type);
  const edited = editedTicket(baseFor(draft.type, draft.missing), draft.texts, draft.lists);
  /** Edits in the view shown or in a view the reporter switched away from: Regenerate and Back would lose them. */
  const edits = hasEdits(draft.baseline, edited) || Object.values(draft.parked).some((view) => view.dirty);
  const previewText = format === 'plain' ? renderPlain(edited) : renderJiraWiki(edited);

  function setText(path: FieldPath, text: string) {
    setState({ ...draft, texts: { ...draft.texts, [path]: text } });
  }

  function setRows(path: FieldPath, rows: Row[]) {
    setState({ ...draft, lists: { ...draft.lists, [path]: rows } });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  function saveJson() {
    downloadText(jsonFileName(edited.type, new Date()), JSON.stringify(edited, null, 2));
  }

  /** Picks the other type: restores the view left earlier, or converts the current ticket in the browser (no model call). */
  function selectType(next: TicketType) {
    if (next === draft.type) return;
    const leaving: ParkedView = {
      texts: draft.texts,
      lists: draft.lists,
      missing: draft.missing,
      convertedFrom: draft.convertedFrom,
      baseline: draft.baseline,
      dirty: hasEdits(draft.baseline, edited),
    };
    const { [next]: restored, ...others } = draft.parked;
    const parked = { ...others, [draft.type]: leaving };
    if (restored) {
      const { texts, lists, missing, convertedFrom, baseline } = restored;
      setState({ ...draft, texts, lists, missing, convertedFrom, baseline, type: next, parked });
    } else {
      setState({ ...draft, ...seedView(convertTicket(edited, next), draft.type), type: next, parked });
    }
  }

  async function sendRegenerate(type: TicketType | undefined) {
    const controller = new AbortController();
    request.current = controller;
    setConfirming(null);
    setError(null);
    setRunning(true);
    try {
      onRegenerated(await generateTicket(transcript, controller.signal, type));
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(describeGenerationError(failure));
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }

  /** Regenerate and Retry: ask first when the edits would be replaced. */
  function regenerate(type?: TicketType) {
    setError(null);
    setRequestedType(type);
    if (edits) setConfirming('regenerate');
    else void sendRegenerate(type);
  }

  /** Back: ask first when the edits would be lost. */
  function back() {
    if (edits) setConfirming('back');
    else onBack();
  }

  function focusField(path: FieldPath) {
    const element = document.getElementById(controlId(path));
    const target = element?.matches('input, textarea') ? element : element?.querySelector<HTMLElement>('textarea, button');
    target?.focus();
  }

  const busy = running;
  return (
    <PageCard>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Button variant="text" startIcon={<ArrowBackIcon />} onClick={back}>
          Back to transcript
        </Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={busy} onClick={() => regenerate()}>
          Regenerate
        </Button>
      </Stack>
      {confirming && (
        <Alert
          severity="warning"
          role="group"
          aria-label="Confirm"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              {confirming === 'regenerate' ? (
                <Button color="inherit" size="small" onClick={() => void sendRegenerate(requestedType)}>
                  Replace
                </Button>
              ) : (
                <Button color="inherit" size="small" onClick={onBack}>
                  Discard
                </Button>
              )}
              <Button color="inherit" size="small" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
            </Stack>
          }
        >
          {confirming === 'regenerate'
            ? 'Regenerating replaces your edits with a new ticket. Continue?'
            : 'Going back discards your edits to this ticket. Continue?'}
        </Alert>
      )}
      {running && (
        <Typography variant="body2" role="status" sx={{ mb: 2 }}>
          Generating…
        </Typography>
      )}
      {error && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Alert severity="error" sx={{ flexGrow: 1 }}>
            {error.message}
          </Alert>
          {error.retryable && (
            <Button variant="outlined" disabled={busy} onClick={() => regenerate(requestedType)}>
              Retry
            </Button>
          )}
        </Stack>
      )}
      <Typography component="h1" variant="h6" sx={{ fontWeight: 600 }}>
        Review ticket
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
        Model {model}, generated in {durationMs} ms
      </Typography>
      <TextField
        select
        size="small"
        id="ticket-type"
        label="Type"
        value={draft.type}
        onChange={(event) => selectType(event.target.value as TicketType)}
        slotProps={{ select: { native: true } }}
        sx={{ minWidth: 160, mb: 2 }}
      >
        <option value="Bug">Bug</option>
        <option value="Feature">Feature</option>
      </TextField>
      {draft.convertedFrom && (
        <Alert
          severity="info"
          role="note"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" disabled={busy} onClick={() => regenerate(draft.type)}>
              Regenerate as {draft.type}
            </Button>
          }
        >
          Converted from {draft.convertedFrom} in your browser. Regenerate as {draft.type} for a better ticket.
        </Alert>
      )}
      <Stack spacing={2}>
        {fields.map((field) =>
          field.kind === 'list' ? (
            <ListField
              key={field.path}
              field={field}
              rows={draft.lists[field.path] ?? []}
              onChange={(rows) => setRows(field.path, rows)}
            />
          ) : (
            <TextInput
              key={field.path}
              field={field}
              value={draft.texts[field.path] ?? ''}
              onChange={(text) => setText(field.path, text)}
            />
          ),
        )}
      </Stack>
      <Divider sx={{ my: 3 }} />
      <section>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Missing information
        </Typography>
        {draft.missing.length === 0 ? (
          <Typography variant="body2">Nothing is missing.</Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {draft.missing.map((item, index) => (
              <li key={index}>
                {item.field && isFieldOf(draft.type, item.field) ? (
                  <Link component="button" type="button" variant="body2" onClick={() => focusField(item.field as FieldPath)}>
                    {item.question}
                  </Link>
                ) : (
                  <Typography variant="body2">{item.question}</Typography>
                )}
              </li>
            ))}
          </Box>
        )}
      </section>
      <Divider sx={{ my: 3 }} />
      <section>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Preview
        </Typography>
        <RadioGroup row aria-label="Format" value={format} onChange={(event) => setFormat(event.target.value as Format)}>
          <FormControlLabel value="plain" control={<Radio />} label="Plain" />
          <FormControlLabel value="wiki" control={<Radio />} label="Jira wiki" />
        </RadioGroup>
        <TextField
          id="preview-text"
          label="Preview"
          multiline
          rows={14}
          fullWidth
          value={previewText}
          slotProps={{ input: { readOnly: true }, htmlInput: { style: { fontFamily: 'ui-monospace, Consolas, monospace' } } }}
          sx={{ mt: 1 }}
        />
        {format === 'wiki' && (
          <>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2, mb: 1 }}>
              How Jira shows it (approximate):
            </Typography>
            <JiraWikiView text={previewText} />
          </>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => void copy()}>
            Copy
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={saveJson}>
            Save as JSON
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            disabled={!jiraEnabled}
            title={jiraEnabled ? undefined : 'Jira is not configured'}
            onClick={() => onConnectJira?.(edited, renderJiraWiki(edited))}
          >
            Connect to Jira board
          </Button>
          <Typography variant="body2" role="status" aria-live="polite">
            {copyStatus === 'copied' && 'Copied'}
            {copyStatus === 'failed' && 'Copy failed. Select the text above and copy it yourself.'}
          </Typography>
        </Stack>
      </section>
    </PageCard>
  );
}

function TextInput({ field, value, onChange }: { field: FieldInfo; value: string; onChange: (text: string) => void }) {
  const id = controlId(field.path);
  const missing = isNotProvided(value);
  const tooLong = field.path === 'title' && value.length > TITLE_HINT_LENGTH;
  return (
    <TextField
      id={id}
      label={field.label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      multiline={field.kind !== 'line'}
      rows={field.kind === 'line' ? undefined : 3}
      fullWidth
      color={missing ? 'warning' : 'primary'}
      helperText={missing ? 'Needs content' : tooLong ? `Title is longer than ${TITLE_HINT_LENGTH} characters.` : undefined}
      className={missing ? 'not-provided' : undefined}
    />
  );
}

function ListField({ field, rows, onChange }: { field: FieldInfo; rows: Row[]; onChange: (rows: Row[]) => void }) {
  const labelId = useId();
  const missing = isNotProvided(rows.map((row) => row.text));
  return (
    <Box className={missing ? 'not-provided' : undefined}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        <span id={labelId}>{field.label}</span>
        {missing && (
          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1, fontWeight: 600 }}>
            Needs content
          </Typography>
        )}
      </Typography>
      <Stack id={controlId(field.path)} role="group" aria-labelledby={labelId} spacing={1}>
        {rows.map((row, index) => {
          const name = `${field.label} item ${index + 1}`;
          return (
            <Stack key={row.id} direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
              <TextField
                multiline
                rows={2}
                fullWidth
                size="small"
                value={row.text}
                slotProps={{ htmlInput: { 'aria-label': name } }}
                onChange={(event) => onChange(updateItem(rows, index, { ...row, text: event.target.value }))}
              />
              <IconButton aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onChange(moveItem(rows, index, -1))}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`Move ${name} down`}
                disabled={index === rows.length - 1}
                onClick={() => onChange(moveItem(rows, index, 1))}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label={`Remove ${name}`} onClick={() => onChange(removeItem(rows, index))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        })}
        <Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            aria-label={`Add ${field.label} item`}
            onClick={() => onChange(addItem(rows, newRow('')))}
          >
            Add
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

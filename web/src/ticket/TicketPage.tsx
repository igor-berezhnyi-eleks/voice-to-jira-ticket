import { useId, useState } from 'react';
import type { GenerateTicketResponse, Ticket } from '../api';
import { controlId, fieldsFor, isFieldOf, type FieldInfo, type FieldPath } from './fieldPaths';
import { addItem, moveItem, removeItem, updateItem } from './listEditing';
import { isNotProvided } from './notProvided';

interface TicketPageProps {
  response: GenerateTicketResponse;
  onBack: () => void;
}

const TITLE_HINT_LENGTH = 120;

/** A list item with a stable id, so a row keeps its text and focus when rows above it move or go. */
interface Row {
  id: number;
  text: string;
}

/** The ticket as edited: text per path, and rows per list path. Held in the browser only. */
interface Draft {
  source: GenerateTicketResponse;
  texts: Partial<Record<FieldPath, string>>;
  lists: Partial<Record<FieldPath, Row[]>>;
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

function seed(response: GenerateTicketResponse): Draft {
  const draft: Draft = { source: response, texts: {}, lists: {} };
  for (const field of fieldsFor(response.ticket.type)) {
    const value = valueAt(response.ticket, field.path);
    if (typeof value === 'string') draft.texts[field.path] = value;
    else draft.lists[field.path] = value.map(newRow);
  }
  return draft;
}

export function TicketPage({ response, onBack }: TicketPageProps) {
  const [state, setState] = useState(() => seed(response));
  // A new response starts a fresh edit state (adjusting state during render, as React documents).
  const draft = state.source === response ? state : seed(response);
  if (draft !== state) setState(draft);

  const { ticket, model, durationMs } = response;
  const fields = fieldsFor(ticket.type);

  function setText(path: FieldPath, text: string) {
    setState({ ...draft, texts: { ...draft.texts, [path]: text } });
  }

  function setRows(path: FieldPath, rows: Row[]) {
    setState({ ...draft, lists: { ...draft.lists, [path]: rows } });
  }

  function focusField(path: FieldPath) {
    const element = document.getElementById(controlId(path));
    const target = element?.matches('input, textarea') ? element : element?.querySelector<HTMLElement>('textarea, button');
    target?.focus();
  }

  return (
    <>
      <button type="button" onClick={onBack}>
        Back to transcript
      </button>
      <h1>Review ticket</h1>
      <p>
        <span className="badge">{ticket.type}</span>
      </p>
      <p className="hint">
        Model {model}, generated in {durationMs} ms
      </p>
      {fields.map((field) =>
        field.kind === 'list' ? (
          <ListField
            key={field.path}
            field={field}
            rows={draft.lists[field.path] ?? []}
            onChange={(rows) => setRows(field.path, rows)}
          />
        ) : (
          <TextField
            key={field.path}
            field={field}
            value={draft.texts[field.path] ?? ''}
            onChange={(text) => setText(field.path, text)}
          />
        ),
      )}
      <section>
        <h2>Missing information</h2>
        {ticket.missingInformation.length === 0 ? (
          <p>Nothing is missing.</p>
        ) : (
          <ul>
            {ticket.missingInformation.map((item, index) => (
              <li key={index}>
                {item.field && isFieldOf(ticket.type, item.field) ? (
                  <button type="button" className="link" onClick={() => focusField(item.field as FieldPath)}>
                    {item.question}
                  </button>
                ) : (
                  item.question
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Cue() {
  return <span className="gap-cue">Needs content</span>;
}

function TextField({ field, value, onChange }: { field: FieldInfo; value: string; onChange: (text: string) => void }) {
  const id = controlId(field.path);
  const missing = isNotProvided(value);
  return (
    <div className={missing ? 'field not-provided' : 'field'}>
      <label htmlFor={id}>{field.label}</label>
      {missing && <Cue />}
      {field.kind === 'line' ? (
        <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <textarea id={id} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.path === 'title' && value.length > TITLE_HINT_LENGTH && (
        <p className="hint">Title is longer than {TITLE_HINT_LENGTH} characters.</p>
      )}
    </div>
  );
}

function ListField({ field, rows, onChange }: { field: FieldInfo; rows: Row[]; onChange: (rows: Row[]) => void }) {
  const labelId = useId();
  const missing = isNotProvided(rows.map((row) => row.text));
  return (
    <div className={missing ? 'field not-provided' : 'field'}>
      <span id={labelId} className="label">
        {field.label}
      </span>
      {missing && <Cue />}
      <div id={controlId(field.path)} role="group" aria-labelledby={labelId}>
        {rows.map((row, index) => {
          const name = `${field.label} item ${index + 1}`;
          return (
            <div key={row.id} className="list-row">
              <textarea
                aria-label={name}
                rows={2}
                value={row.text}
                onChange={(event) => onChange(updateItem(rows, index, { ...row, text: event.target.value }))}
              />
              <button
                type="button"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => onChange(moveItem(rows, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${name} down`}
                disabled={index === rows.length - 1}
                onClick={() => onChange(moveItem(rows, index, 1))}
              >
                ↓
              </button>
              <button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(removeItem(rows, index))}>
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" aria-label={`Add ${field.label} item`} onClick={() => onChange(addItem(rows, newRow('')))}>
          Add
        </button>
      </div>
    </div>
  );
}

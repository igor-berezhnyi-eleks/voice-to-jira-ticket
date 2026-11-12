import { useId, useState } from 'react';
import type { FieldDraft } from './fieldValues';
import type { JiraField } from './jiraApi';

interface FieldInputProps {
  field: JiraField;
  value: FieldDraft | undefined;
  onChange: (value: FieldDraft) => void;
  /** Jira's message for this field after a rejected create. */
  error?: string;
  /** Shown as "Remove" beside the label for optional fields the user added. */
  onRemove?: () => void;
}

/** One control for one field, chosen only by `kind`; it never looks at Jira field ids. */
export function FieldInput({ field, value, onChange, error, onRemove }: FieldInputProps) {
  const id = useId();
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];
  const allowed = field.allowedValues ?? [];

  let control;
  switch (field.kind) {
    case 'text':
      control = <input id={id} type="text" value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'textarea':
      control = <textarea id={id} rows={4} value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      control = <input id={id} type="number" value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'date':
      control = <input id={id} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'option':
      control = (
        <select id={id} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {allowed.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      );
      break;
    case 'options':
      control = (
        <select
          id={id}
          multiple
          size={Math.min(Math.max(allowed.length, 2), 6)}
          value={list}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions, (option) => option.value))}
        >
          {allowed.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      );
      break;
    case 'labels':
      control = <LabelsInput id={id} labels={list} onChange={onChange} />;
      break;
    default:
      control = null;
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {field.name}
        {field.required && !field.hasDefaultValue ? ' (required)' : ''}
      </label>
      {control}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove field ${field.name}`}>
          Remove
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

const MAX_LABEL = 255;

/** Tag input: Enter, comma or Add commits a label; a space is refused, because Jira labels cannot contain one. */
function LabelsInput({ id, labels, onChange }: { id: string; labels: string[]; onChange: (value: string[]) => void }) {
  const [text, setText] = useState('');
  const [refused, setRefused] = useState(false);

  function commit() {
    const label = text.trim();
    if (label === '') return;
    if (!labels.includes(label)) onChange([...labels, label]);
    setText('');
  }

  return (
    <div className="labels-input">
      <input
        id={id}
        type="text"
        autoComplete="off"
        maxLength={MAX_LABEL}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          if (/\s/.test(next)) {
            setRefused(true);
            return;
          }
          setRefused(false);
          setText(next.endsWith(',') ? next.slice(0, -1) : next);
          if (next.endsWith(',')) {
            const label = next.slice(0, -1);
            if (label !== '') {
              if (!labels.includes(label)) onChange([...labels, label]);
              setText('');
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button type="button" onClick={commit}>
        Add label
      </button>
      {refused && (
        <p role="status" className="hint">
          Labels cannot contain spaces.
        </p>
      )}
      {labels.length > 0 && (
        <ul className="tags">
          {labels.map((label) => (
            <li key={label}>
              {label}{' '}
              <button type="button" aria-label={`Remove label ${label}`} onClick={() => onChange(labels.filter((l) => l !== label))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

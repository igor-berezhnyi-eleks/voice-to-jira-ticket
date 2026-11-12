import { useState } from 'react';
import { FieldInput } from './FieldInput';
import { addableFields, blockingFields, isSupportedKind, type FieldDraft } from './fieldValues';
import type { JiraField } from './jiraApi';

interface FieldsSectionProps {
  fields: JiraField[];
  values: Record<string, FieldDraft>;
  /** Ids of the optional fields the user added. */
  added: string[];
  /** Jira's messages by field id from a rejected create. */
  errors: Record<string, string>;
  onChange: (fieldId: string, value: FieldDraft) => void;
  onAdd: (fieldId: string) => void;
  onRemove: (fieldId: string) => void;
}

/** The field area of Page 3: required fields, a blocking notice for those the app cannot fill, and "Add field". */
export function FieldsSection({ fields, values, added, errors, onChange, onAdd, onRemove }: FieldsSectionProps) {
  const [picking, setPicking] = useState('');
  const required = blockingFields(fields);
  const fillable = required.filter((field) => isSupportedKind(field.kind));
  const unfillable = required.filter((field) => !isSupportedKind(field.kind));
  const shown = added.flatMap((id) => fields.filter((field) => field.fieldId === id));
  const offered = addableFields(fields).filter((field) => !added.includes(field.fieldId));

  return (
    <>
      {unfillable.map((field) => (
        <div key={field.fieldId} className="notice" role="alert">
          <p>
            This issue type requires &lsquo;{field.name}&rsquo;, which this app can&rsquo;t fill. Pick another issue type or create the
            issue in Jira.
          </p>
        </div>
      ))}

      {fillable.map((field) => (
        <FieldInput
          key={field.fieldId}
          field={field}
          value={values[field.fieldId]}
          error={errors[field.fieldId]}
          onChange={(value) => onChange(field.fieldId, value)}
        />
      ))}

      {shown.map((field) => (
        <FieldInput
          key={field.fieldId}
          field={field}
          value={values[field.fieldId]}
          error={errors[field.fieldId]}
          onChange={(value) => onChange(field.fieldId, value)}
          onRemove={() => onRemove(field.fieldId)}
        />
      ))}

      {offered.length > 0 && (
        <div className="field add-field">
          <label htmlFor="jira-add-field">Add field</label>
          <select id="jira-add-field" value={picking} onChange={(e) => setPicking(e.target.value)}>
            <option value="">Choose a field…</option>
            {offered.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {field.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={picking === ''}
            onClick={() => {
              onAdd(picking);
              setPicking('');
            }}
          >
            Add
          </button>
        </div>
      )}
    </>
  );
}

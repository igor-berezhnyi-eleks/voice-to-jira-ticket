import { useState } from 'react';
import { Alert, Button, Stack } from '@eleks-ui/components';
import AddIcon from '@mui/icons-material/Add';
import { useT } from '../i18n/LanguageProvider';
import { NativeSelect } from '../layout/NativeSelect';
import { FieldInput } from './FieldInput';
import { fieldName } from './fieldNames';
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
  const t = useT();
  const j = t.jira;
  const [picking, setPicking] = useState('');
  const required = blockingFields(fields);
  const fillable = required.filter((field) => isSupportedKind(field.kind));
  const unfillable = required.filter((field) => !isSupportedKind(field.kind));
  const shown = added.flatMap((id) => fields.filter((field) => field.fieldId === id));
  const offered = addableFields(fields).filter((field) => !added.includes(field.fieldId));

  return (
    <Stack spacing={2}>
      {unfillable.map((field) => (
        <Alert key={field.fieldId} severity="warning" role="alert">
          {j.requiresField(fieldName(field, t))}
        </Alert>
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
        <Stack direction="row" spacing={1} className="field add-field" sx={{ alignItems: 'flex-start' }}>
          <NativeSelect id="jira-add-field" label={j.addField} value={picking} onChange={(e) => setPicking(e.target.value)}>
            <option value="">{j.chooseField}</option>
            {offered.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {fieldName(field, t)}
              </option>
            ))}
          </NativeSelect>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={picking === ''}
            onClick={() => {
              onAdd(picking);
              setPicking('');
            }}
            sx={{ flexShrink: 0, height: 40 }}
          >
            {j.add}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

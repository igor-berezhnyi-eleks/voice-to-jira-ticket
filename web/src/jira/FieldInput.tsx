import { useId, useState } from 'react';
import { Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@eleks-ui/components';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '../i18n/LanguageProvider';
import { NativeSelect } from '../layout/NativeSelect';
import { fieldName } from './fieldNames';
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

/** One control for one field, chosen only by `kind`; the field id is used only for the shown name (`fieldName`). */
export function FieldInput({ field, value, onChange, error, onRemove }: FieldInputProps) {
  const t = useT();
  const j = t.jira;
  const id = useId();
  const name = fieldName(field, t);
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];
  const allowed = field.allowedValues ?? [];

  const label = `${name}${field.required && !field.hasDefaultValue ? j.requiredSuffix : ''}`;

  let control;
  switch (field.kind) {
    case 'text':
      control = <TextField id={id} label={label} size="small" fullWidth value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'textarea':
      control = <TextField id={id} label={label} multiline rows={4} fullWidth value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      control = <TextField id={id} label={label} type="number" size="small" fullWidth value={text} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'date':
      control = (
        <TextField
          id={id}
          label={label}
          type="date"
          size="small"
          fullWidth
          value={text}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      );
      break;
    case 'option':
      control = (
        <NativeSelect id={id} label={label} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">{j.choose}</option>
          {allowed.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case 'options':
      control = (
        <NativeSelect
          id={id}
          label={label}
          multiple
          rows={Math.min(Math.max(allowed.length, 2), 6)}
          value={list}
          onChange={(e) => onChange(Array.from((e.target as unknown as HTMLSelectElement).selectedOptions, (option) => option.value))}
        >
          {allowed.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case 'labels':
      control = <LabelsInput id={id} label={label} labels={list} onChange={onChange} />;
      break;
    default:
      control = null;
  }

  return (
    <Box className="field">
      {control}
      {onRemove && (
        <Button variant="text" size="small" onClick={onRemove} aria-label={j.removeField(name)} sx={{ mt: 0.5 }}>
          {j.remove}
        </Button>
      )}
      {error && (
        <Typography role="alert" variant="caption" color="error" component="p" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

const MAX_LABEL = 255;

/** Tag input: Enter, comma or Add commits a label; a space is refused, because Jira labels cannot contain one. */
function LabelsInput({
  id,
  label: fieldLabel,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  labels: string[];
  onChange: (value: string[]) => void;
}) {
  const j = useT().jira;
  const [text, setText] = useState('');
  const [refused, setRefused] = useState(false);

  function commit() {
    const label = text.trim();
    if (label === '') return;
    if (!labels.includes(label)) onChange([...labels, label]);
    setText('');
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          id={id}
          label={fieldLabel}
          size="small"
          fullWidth
          autoComplete="off"
          value={text}
          slotProps={{ htmlInput: { maxLength: MAX_LABEL } }}
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
        <Button variant="outlined" onClick={commit} sx={{ flexShrink: 0, height: 40 }}>
          {j.addLabel}
        </Button>
      </Stack>
      {refused && (
        <Typography role="status" variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {j.labelsNoSpaces}
        </Typography>
      )}
      {labels.length > 0 && (
        <Box component="ul" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, listStyle: 'none', m: 0, mt: 1, p: 0 }}>
          {labels.map((label) => (
            <Box component="li" key={label} sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <Chip size="small" label={label} />
              <IconButton size="small" aria-label={j.removeLabel(label)} onClick={() => onChange(labels.filter((l) => l !== label))}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

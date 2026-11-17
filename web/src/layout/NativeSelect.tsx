import type { ChangeEvent, ReactNode } from 'react';
import { TextField } from '@eleks-ui/components';

interface NativeSelectProps {
  id: string;
  label: string;
  value: string | string[];
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  children: ReactNode;
  multiple?: boolean;
  /** Visible rows of a multiple select. */
  rows?: number;
  fullWidth?: boolean;
}

/**
 * A labelled ELEKS UI select that uses the browser's own `<select>`. Jira lists can be long and are
 * often used on a phone, where the native picker is the better control; it also keeps the options
 * readable by assistive technology and tests as plain `<option>` elements.
 */
export function NativeSelect({ id, label, value, onChange, children, multiple, rows, fullWidth = true }: NativeSelectProps) {
  return (
    <TextField
      select
      id={id}
      label={label}
      size="small"
      fullWidth={fullWidth}
      value={value}
      onChange={onChange}
      // A native select always shows an option, so the label must always float; otherwise an empty value
      // ("Choose a field…") is drawn on top of the unfloated label.
      slotProps={{
        inputLabel: { shrink: true },
        select: { native: true, multiple, ...(rows ? { inputProps: { size: rows } } : {}) },
      }}
    >
      {children}
    </TextField>
  );
}

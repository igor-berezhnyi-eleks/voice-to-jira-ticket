import { Autocomplete as MuiAutocomplete } from '@mui/material';
import type { AutocompleteProps as MuiAutocompleteProps } from '@mui/material';

export type AutocompleteProps<
  Value,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined
> = MuiAutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>;

export const Autocomplete = MuiAutocomplete as typeof MuiAutocomplete;

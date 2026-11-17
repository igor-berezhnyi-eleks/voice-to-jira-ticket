import {
  FormControlLabel as MuiFormControlLabel,
  type FormControlLabelProps as MuiFormControlLabelProps
} from '@mui/material';

export interface FormControlLabelProps extends MuiFormControlLabelProps {}

export const FormControlLabel = ({ ...props }: FormControlLabelProps) => (
  <MuiFormControlLabel {...props} />
);

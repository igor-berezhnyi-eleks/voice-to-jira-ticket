import {
  FormControl as MuiFormControl,
  type FormControlProps as MuiFormControlProps
} from '@mui/material';

export interface FormControlProps extends MuiFormControlProps {}

export const Form = ({ children, ...props }: FormControlProps) => (
  <MuiFormControl {...props}>{children}</MuiFormControl>
);

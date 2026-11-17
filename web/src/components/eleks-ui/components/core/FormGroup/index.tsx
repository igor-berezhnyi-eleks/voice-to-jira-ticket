import {
  FormGroup as MuiFormGroup,
  type FormGroupProps as MuiFormGroupProps,
  type FormControlProps as MuiFormControlProps,
  FormControl as MuiFormControl
} from '@mui/material';

export interface FormGroupProps extends MuiFormGroupProps {}

export const FormGroup = ({ children, ...props }: FormGroupProps) => {
  return <MuiFormGroup {...props}>{children}</MuiFormGroup>;
};

export interface FormControlProps extends MuiFormControlProps {}

export const FormControl = ({ children, ...props }: FormControlProps) => {
  return <MuiFormControl {...props}>{children}</MuiFormControl>;
};

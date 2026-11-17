import {
  FormGroup as MuiFormGroup,
  type FormGroupProps as MuiFormGroupProps
} from '@mui/material';

export interface CheckboxGroupProps extends MuiFormGroupProps {
  children: React.ReactNode;
}

export const CheckboxGroup = ({ children, ...props }: CheckboxGroupProps) => {
  return (
    <MuiFormGroup role="CheckboxGroup" {...props}>
      {children}
    </MuiFormGroup>
  );
};

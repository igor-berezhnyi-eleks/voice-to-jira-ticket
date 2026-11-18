import {
  FormGroup as MuiFormGroup,
  type FormGroupProps as MuiFormGroupProps
} from '@mui/material';

export interface SwitchGroupProps extends MuiFormGroupProps {
  children: React.ReactNode;
}

export const SwitchGroup = ({ children, ...props }: SwitchGroupProps) => {
  return (
    <MuiFormGroup role="SwitchGroup" {...props}>
      {children}
    </MuiFormGroup>
  );
};

import {
  FormLabel as MuiFormLabel,
  type FormLabelProps as MuiFormLabelProps
} from '@mui/material';

export interface FormLabelProps extends MuiFormLabelProps {
  children: React.ReactNode;
}

export const FormLabel = ({ children, ...props }: FormLabelProps) => {
  return <MuiFormLabel {...props}>{children}</MuiFormLabel>;
};

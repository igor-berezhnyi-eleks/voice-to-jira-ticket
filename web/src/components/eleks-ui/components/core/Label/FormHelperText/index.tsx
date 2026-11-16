import {
  FormHelperText as MuiFormHelperText,
  type FormHelperTextProps as MuiFormHelperTextProps
} from '@mui/material';

export interface FormHelperTextProps extends MuiFormHelperTextProps {
  children: React.ReactNode;
}

export const FormHelperText = ({ children, ...props }: FormHelperTextProps) => {
  return <MuiFormHelperText {...props}>{children}</MuiFormHelperText>;
};

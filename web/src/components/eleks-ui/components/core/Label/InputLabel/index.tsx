import {
  InputLabel as MuiInputLabel,
  type InputLabelProps as MuiInputLabelProps
} from '@mui/material';

export interface InputLabelProps extends MuiInputLabelProps {
  children: React.ReactNode;
}

export const InputLabel = ({ children, ...props }: InputLabelProps) => {
  return <MuiInputLabel {...props}>{children}</MuiInputLabel>;
};

import {
  InputAdornment as MuiInputAdornment,
  type InputAdornmentProps as MuiInputAdornmentProps
} from '@mui/material';

export interface InputAdornmentProps extends MuiInputAdornmentProps {}

export const InputAdornment = ({ children, ...props }: InputAdornmentProps) => (
  <MuiInputAdornment {...props}>{children}</MuiInputAdornment>
);

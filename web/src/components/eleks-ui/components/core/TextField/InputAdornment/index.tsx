import {
  InputAdornment as MuiInputAdornment,
  type InputAdornmentProps as BaseInputAdornmentProps
} from '@mui/material';

export interface InputAdornmentProps extends BaseInputAdornmentProps {
  children: React.ReactNode;
}

export const InputAdornment = ({ children, ...props }: InputAdornmentProps) => {
  return <MuiInputAdornment {...props}>{children}</MuiInputAdornment>;
};

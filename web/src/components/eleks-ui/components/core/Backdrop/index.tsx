import {
  Backdrop as MuiBackdrop,
  type BackdropProps as MuiBackdropProps
} from '@mui/material';

export interface BackdropProps extends MuiBackdropProps {
  children?: React.ReactNode;
}

export const Backdrop = ({ children, ...rest }: BackdropProps) => {
  return <MuiBackdrop {...rest}>{children}</MuiBackdrop>;
};

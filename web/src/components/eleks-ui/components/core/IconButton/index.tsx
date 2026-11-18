import {
  IconButton as MuiIconButton,
  type IconButtonProps as MuiIconButtonProps
} from '@mui/material';

export interface IconButtonProps extends MuiIconButtonProps {
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const IconButton = ({ children, ...rest }: IconButtonProps) => (
  <MuiIconButton {...rest}>{children}</MuiIconButton>
);

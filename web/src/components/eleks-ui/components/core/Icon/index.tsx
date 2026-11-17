import { Icon as MuiIcon, type IconProps as MuiIconProps } from '@mui/material';

export interface IconProps extends MuiIconProps {
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const Icon = ({ children, ...rest }: IconProps) => (
  <MuiIcon {...rest}>{children}</MuiIcon>
);

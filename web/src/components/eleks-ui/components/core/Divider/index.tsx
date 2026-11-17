import {
  Divider as MuiDivider,
  type DividerProps as MuiDividerProps
} from '@mui/material';

export interface DividerProps extends MuiDividerProps {
  children?: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
}

export const Divider = ({ children, ...props }: DividerProps) => {
  return <MuiDivider {...props}>{children}</MuiDivider>;
};

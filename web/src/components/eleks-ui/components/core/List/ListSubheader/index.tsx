import {
  ListSubheader as MuiListSubheader,
  type ListSubheaderProps as MuiListSubheaderProps
} from '@mui/material';

export interface ListSubheaderProps extends MuiListSubheaderProps {
  children: React.ReactNode;
}

export const ListSubheader = ({ children, ...props }: ListSubheaderProps) => {
  return <MuiListSubheader {...props}>{children}</MuiListSubheader>;
};

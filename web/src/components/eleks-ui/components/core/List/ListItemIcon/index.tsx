import {
  ListItemIcon as MuiListItemIcon,
  type ListItemIconProps as MuiListItemIconProps
} from '@mui/material';

export interface ListItemIconProps extends MuiListItemIconProps {
  children: React.ReactNode;
}

export const ListItemIcon = ({ children, ...props }: ListItemIconProps) => {
  return <MuiListItemIcon {...props}>{children}</MuiListItemIcon>;
};

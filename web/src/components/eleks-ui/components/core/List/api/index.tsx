import {
  ListItemButton as MuiListItemButton,
  type ListItemButtonProps as MuiListItemButtonProps
} from '@mui/material';

export interface ListItemButtonProps extends MuiListItemButtonProps {}

export const ListItemButton = ({ children, ...props }: ListItemButtonProps) => {
  return <MuiListItemButton {...props}>{children}</MuiListItemButton>;
};

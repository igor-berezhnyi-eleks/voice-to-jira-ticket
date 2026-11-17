import {
  ListItem as MuiListItem,
  type ListItemProps as MuiListItemProps
} from '@mui/material';

export interface ListItemProps extends MuiListItemProps {
  children: React.ReactNode;
}

export const ListItem = ({ children, ...props }: ListItemProps) => {
  return <MuiListItem {...props}>{children}</MuiListItem>;
};

import {
  ListItemText as MuiListItemText,
  type ListItemTextProps as MuiListItemTextProps
} from '@mui/material';

export interface ListItemTextProps extends MuiListItemTextProps {}

export const ListItemText = ({ ...props }: ListItemTextProps) => {
  return <MuiListItemText {...props} />;
};

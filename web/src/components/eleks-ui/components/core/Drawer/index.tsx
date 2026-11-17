import {
  Drawer as MuiDrawer,
  type DrawerProps as MuiDrawerProps
} from '@mui/material';

export interface DrawerProps extends MuiDrawerProps {
  children?: React.ReactNode;
}

export const Drawer = ({ children, ...rest }: DrawerProps) => {
  return <MuiDrawer {...rest}>{children}</MuiDrawer>;
};

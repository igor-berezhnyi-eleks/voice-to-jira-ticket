import {
  MenuList as MuiMenuList,
  type MenuListProps as MuiMenuListProps
} from '@mui/material';

export interface MenuListProps extends MuiMenuListProps {
  children: React.ReactNode;
}

export const MenuList = ({ children, ...props }: MenuListProps) => {
  return <MuiMenuList {...props}>{children}</MuiMenuList>;
};

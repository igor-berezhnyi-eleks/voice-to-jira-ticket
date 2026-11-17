import { Tabs as MuiTabs, type TabsProps as MuiTabsProps } from '@mui/material';

export interface TabsProps extends MuiTabsProps {
  children: React.ReactNode;
}

export const Tabs = ({ children, ...props }: TabsProps) => {
  return <MuiTabs {...props}>{children}</MuiTabs>;
};

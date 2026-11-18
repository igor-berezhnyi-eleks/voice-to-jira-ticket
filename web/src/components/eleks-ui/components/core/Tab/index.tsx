import { Tab as MuiTab, type TabProps as MuiTabProps } from '@mui/material';

export interface TabProps extends MuiTabProps { }

export const Tab = (props: TabProps) => {
  return <MuiTab {...props} />;
};

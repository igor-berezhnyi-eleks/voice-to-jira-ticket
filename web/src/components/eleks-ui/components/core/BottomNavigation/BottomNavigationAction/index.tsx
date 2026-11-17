import {
  BottomNavigationAction as MuiBottomNavigationAction,
  type BottomNavigationActionProps as MuiBottomNavigationActionProps
} from '@mui/material';

export interface BottomNavigationActionProps
  extends MuiBottomNavigationActionProps { }

export const BottomNavigationAction = ({
  ...props
}: BottomNavigationActionProps) => {
  return <MuiBottomNavigationAction {...props} />;
};

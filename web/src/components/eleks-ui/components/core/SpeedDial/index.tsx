import {
  SpeedDial as MuiSpeedDial,
  type SpeedDialProps as MuiSpeedDialProps
} from '@mui/material';

export interface SpeedDialProps extends MuiSpeedDialProps {
  children: React.ReactNode;
}

export const SpeedDial = ({ children, ...props }: SpeedDialProps) => {
  return <MuiSpeedDial {...props}>{children}</MuiSpeedDial>;
};

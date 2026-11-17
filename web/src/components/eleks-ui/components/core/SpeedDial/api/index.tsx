import {
  SpeedDialAction as MuiSpeedDialAction,
  type SpeedDialActionProps as MuiSpeedDialActionProps,
  SpeedDialIcon as MuiSpeedDialIcon,
  type SpeedDialIconProps as MuiSpeedDialIconProps
} from '@mui/material';

export interface SpeedDialActionProps extends MuiSpeedDialActionProps { }
export const SpeedDialAction = ({ ...props }: SpeedDialActionProps) => (
  <MuiSpeedDialAction {...props} />
);

export interface SpeedDialIconProps extends MuiSpeedDialIconProps { }
export const SpeedDialIcon = ({ ...props }: SpeedDialIconProps) => (
  <MuiSpeedDialIcon {...props} />
);

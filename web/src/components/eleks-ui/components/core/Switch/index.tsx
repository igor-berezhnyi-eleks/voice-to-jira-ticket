import {
  Switch as MuiSwitch,
  type SwitchProps as MuiSwitchProps
} from '@mui/material';

export interface SwitchProps extends MuiSwitchProps { }

export const Switch = ({ ...props }: SwitchProps) => {
  return <MuiSwitch {...props} />;
};

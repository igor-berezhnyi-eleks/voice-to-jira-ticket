import {
  ToggleButton as MuiToggleButton,
  type ToggleButtonProps as MuiToggleButtonProps
} from '@mui/material';

export interface ToggleButtonProps extends MuiToggleButtonProps {
  children?: React.ReactNode;
}

export const ToggleButton = ({ children, ...props }: ToggleButtonProps) => {
  return <MuiToggleButton {...props}>{children}</MuiToggleButton>;
};

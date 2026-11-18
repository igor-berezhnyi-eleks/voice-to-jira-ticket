import {
  ToggleButtonGroup as MuiToggleButtonGroup,
  type ToggleButtonGroupProps as MuiToggleButtonGroupProps
} from '@mui/material';

export interface ToggleButtonGroupProps extends MuiToggleButtonGroupProps {
  children: React.ReactNode;
}

export const ToggleButtonGroup = ({
  children,
  ...props
}: ToggleButtonGroupProps) => {
  return <MuiToggleButtonGroup {...props}>{children}</MuiToggleButtonGroup>;
};

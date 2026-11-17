import {
  Tooltip as MuiTooltip,
  type TooltipProps as MuiTooltipProps
} from '@mui/material';

export interface TooltipProps extends MuiTooltipProps {}

export const Tooltip = ({ children, ...props }: TooltipProps) => {
  return <MuiTooltip {...props}>{children}</MuiTooltip>;
};

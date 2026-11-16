import {
  CardActions as MuiCardActions,
  type CardActionsProps as MuiCardActionsProps
} from '@mui/material';

export interface CardActionsProps extends MuiCardActionsProps { }

export const CardActions = ({ children, ...props }: CardActionsProps) => {
  return <MuiCardActions {...props}>{children}</MuiCardActions>;
};

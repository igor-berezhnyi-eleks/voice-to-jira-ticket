import {
  CardContent as MuiCardContent,
type   CardContentProps as MuiCardContentProps
} from '@mui/material';

export interface CardContentProps extends MuiCardContentProps {}

export const CardContent = ({ children, ...props }: CardContentProps) => {
  return <MuiCardContent {...props}>{children}</MuiCardContent>;
};

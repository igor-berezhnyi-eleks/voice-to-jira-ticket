import {
  CardHeader as MuiCardHeader,
  type CardHeaderProps as MuiCardHeaderProps
} from '@mui/material';

export interface CardHeaderProps extends MuiCardHeaderProps { }

export const CardHeader = ({ ...props }: CardHeaderProps) => {
  return <MuiCardHeader {...props} />;
};

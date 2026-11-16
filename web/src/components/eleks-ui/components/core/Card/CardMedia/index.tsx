import {
  CardMedia as MuiCardMedia,
  type CardMediaProps as MuiCardMediaProps
} from '@mui/material';

export interface CardMediaProps extends MuiCardMediaProps { }

export const CardMedia = ({ ...props }: CardMediaProps) => {
  return <MuiCardMedia {...props} />;
};

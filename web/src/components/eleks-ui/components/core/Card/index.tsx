import { Card as MuiCard, type CardProps as MuiCardProps } from '@mui/material';

export interface CardProps extends MuiCardProps {}

export const Card = ({ children, ...props }: CardProps) => (
  <MuiCard {...props}>{children}</MuiCard>
);

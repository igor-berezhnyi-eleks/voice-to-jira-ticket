import { Fab as MuiFab, type FabProps as MuiFabProps } from '@mui/material';

export interface FabProps extends MuiFabProps {}

export const Fab = ({ children, ...props }: FabProps) => {
  return <MuiFab {...props}>{children}</MuiFab>;
};

import {
  Box as MuiBox,
  type BoxProps as MuiBoxProps,
  Grid as MuiGrid,
  type GridProps as MuiGridProps
} from '@mui/material';

export interface BoxProps extends MuiBoxProps { }

export const Box = ({ children, ...props }: BoxProps) => (
  <MuiBox {...props}>{children}</MuiBox>
);

export interface GridProps extends MuiGridProps { }

export const Grid = ({ children, ...props }: GridProps) => (
  <MuiGrid {...props}>{children}</MuiGrid>
);

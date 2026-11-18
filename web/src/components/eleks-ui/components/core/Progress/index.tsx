import {
  CircularProgress as MuiCircularProgress,
  LinearProgress as MuiLinearProgress,
  type CircularProgressProps as MuiCircularProgressProps,
  type LinearProgressProps as MuiLinearProgressProps
} from '@mui/material';

export interface CircularProgressProps extends MuiCircularProgressProps {}

export interface LinearProgressProps extends MuiLinearProgressProps {}

export const CircularProgress = ({ ...props }: CircularProgressProps) => {
  return <MuiCircularProgress {...props} />;
};

export const LinearProgress = ({ ...props }: LinearProgressProps) => {
  return <MuiLinearProgress {...props} />;
};

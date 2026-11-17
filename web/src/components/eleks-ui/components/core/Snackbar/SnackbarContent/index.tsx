import {
  SnackbarContent as MuiSnackbarContent,
  type SnackbarContentProps as MuiSnackbarContentProps
} from '@mui/material';

export interface SnackbarContentProps extends MuiSnackbarContentProps { }

export const SnackbarContent = ({ ...props }: SnackbarContentProps) => {
  return <MuiSnackbarContent {...props} />;
};

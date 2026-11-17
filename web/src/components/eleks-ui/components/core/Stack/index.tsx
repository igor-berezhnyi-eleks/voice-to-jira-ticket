import {
  Stack as MuiStack,
  type StackProps as MuiStackProps
} from '@mui/material';

export interface StackProps extends MuiStackProps {
  children: React.ReactNode;
}

export const Stack = ({ children, ...props }: StackProps) => {
  return <MuiStack {...props}>{children}</MuiStack>;
};

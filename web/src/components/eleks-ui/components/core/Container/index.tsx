import {
  Container as MuiContainer,
  type ContainerProps as MuiContainerProps
} from '@mui/material';

export interface ContainerProps extends MuiContainerProps {
  children: React.ReactNode;
}

export const Container = ({ children, ...rest }: ContainerProps) => {
  return <MuiContainer {...rest}>{children}</MuiContainer>;
};

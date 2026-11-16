import { Link as MuiLink, type LinkProps as MuiLinkProps } from '@mui/material';

export interface LinkProps extends MuiLinkProps {
  children: React.ReactNode;
}

export const Link = ({ children, ...props }: LinkProps) => {
  return <MuiLink {...props}>{children}</MuiLink>;
};

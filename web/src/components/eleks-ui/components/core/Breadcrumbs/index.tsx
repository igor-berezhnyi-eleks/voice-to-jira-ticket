import {
  Breadcrumbs as MuiBreadcrumbs,
  type BreadcrumbsProps as MuiBreadcrumbsProps
} from '@mui/material';

export interface BreadcrumbsProps extends MuiBreadcrumbsProps {
  children?: React.ReactNode;
}

export const Breadcrumbs = ({ children, ...rest }: BreadcrumbsProps) => {
  return <MuiBreadcrumbs {...rest}>{children}</MuiBreadcrumbs>;
};

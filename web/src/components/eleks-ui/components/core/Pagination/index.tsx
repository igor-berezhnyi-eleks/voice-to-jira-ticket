import {
  Pagination as MuiPagination,
  type PaginationProps as MuiPaginationProps
} from '@mui/material';

export interface PaginationProps extends MuiPaginationProps {
  children: React.ReactNode;
}

export const Pagination = ({ children, ...props }: PaginationProps) => {
  return <MuiPagination {...props}>{children}</MuiPagination>;
};

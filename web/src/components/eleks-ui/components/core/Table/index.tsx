import {
  Table as MuiTable,
  type TableProps as MuiTableProps,
  TablePagination as MuiTablePagination,
  type TablePaginationProps as MuiTablePaginationProps
} from '@mui/material';

export interface TableProps extends MuiTableProps {
  children: React.ReactNode;
}

// TODO: implement sub components
export const Table = ({ children, ...props }: TableProps) => {
  return <MuiTable {...props}>{children}</MuiTable>;
};

export type TablePaginationProps = MuiTablePaginationProps;

export const TablePagination = (props: TablePaginationProps) => {
  return <MuiTablePagination component="div" {...props} />;
};

import {
  TableBody as MuiTableBody,
  type TableBodyProps as MuiTableBodyProps
} from '@mui/material';

export interface TableBodyProps extends MuiTableBodyProps {
  children: React.ReactNode;
}

export const TableBody = ({ children, ...props }: TableBodyProps) => {
  return <MuiTableBody {...props}>{children}</MuiTableBody>;
};

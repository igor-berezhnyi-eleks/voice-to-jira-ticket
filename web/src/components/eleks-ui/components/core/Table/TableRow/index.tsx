import {
  TableRow as MuiTableRow,
  type TableRowProps as MuiTableRowProps
} from '@mui/material';

export interface TableRowProps extends MuiTableRowProps {
  children: React.ReactNode;
}

export const TableRow = ({ children, ...props }: TableRowProps) => {
  return <MuiTableRow {...props}>{children}</MuiTableRow>;
};

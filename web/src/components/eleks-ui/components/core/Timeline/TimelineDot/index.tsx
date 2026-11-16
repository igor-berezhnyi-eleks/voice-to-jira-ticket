import {
  TimelineDot as MuiTimelineDot,
  type TimelineDotProps as MuiTimelineDotProps
} from '@mui/lab';

export interface TimelineDotProps extends MuiTimelineDotProps {
  children: React.ReactNode;
}

export const TimelineDot = ({ children, ...props }: TimelineDotProps) => {
  return <MuiTimelineDot {...props}>{children}</MuiTimelineDot>;
};

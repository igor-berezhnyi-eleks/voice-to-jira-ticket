import {
  TimelineSeparator as MuiTimelineSeparator,
  type TimelineSeparatorProps as MuiTimelineSeparatorProps
} from '@mui/lab';

export interface TimelineSeparatorProps extends MuiTimelineSeparatorProps {
  children: React.ReactNode;
}

export const TimelineSeparator = ({
  children,
  ...props
}: TimelineSeparatorProps) => {
  return <MuiTimelineSeparator {...props}>{children}</MuiTimelineSeparator>;
};

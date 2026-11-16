import {
  TimelineContent as MuiTimelineContent,
  type TimelineContentProps as MuiTimelineContentProps
} from '@mui/lab';

export interface TimelineContentProps extends MuiTimelineContentProps {
  children: React.ReactNode;
}

export const TimelineContent = ({
  children,
  ...props
}: TimelineContentProps) => {
  return <MuiTimelineContent {...props}>{children}</MuiTimelineContent>;
};

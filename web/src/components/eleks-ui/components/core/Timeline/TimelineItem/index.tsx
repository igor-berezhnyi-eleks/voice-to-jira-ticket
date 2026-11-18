import {
  TimelineItem as MuiTimelineItem,
  type TimelineItemProps as MuiTimelineItemProps
} from '@mui/lab';

export interface TimelineItemProps extends MuiTimelineItemProps {
  children: React.ReactNode;
}

export const TimelineItem = ({ children, ...props }: TimelineItemProps) => {
  return <MuiTimelineItem {...props}>{children}</MuiTimelineItem>;
};

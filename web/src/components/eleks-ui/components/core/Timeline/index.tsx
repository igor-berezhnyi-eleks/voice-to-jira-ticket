import {
  Timeline as MuiTimeline,
  type TimelineProps as MuiTimelineProps
} from '@mui/lab';

export interface TimelineProps extends MuiTimelineProps {
  children: React.ReactNode;
}

export const Timeline = ({ children, ...props }: TimelineProps) => {
  return <MuiTimeline {...props}>{children}</MuiTimeline>;
};

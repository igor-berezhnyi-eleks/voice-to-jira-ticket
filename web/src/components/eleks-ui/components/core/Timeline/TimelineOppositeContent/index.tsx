import {
  TimelineOppositeContent as MuiTimelineOppositeContent,
  type TimelineOppositeContentProps as MuiTimelineOppositeContentProps
} from '@mui/lab';

export interface TimelineOppositeContentProps
  extends MuiTimelineOppositeContentProps {
  children: React.ReactNode;
}

export const TimelineOppositeContent = ({
  children,
  ...props
}: TimelineOppositeContentProps) => {
  return (
    <MuiTimelineOppositeContent {...props}>
      {children}
    </MuiTimelineOppositeContent>
  );
};

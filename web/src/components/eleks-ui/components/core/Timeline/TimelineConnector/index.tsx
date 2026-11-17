import {
  TimelineConnector as MuiTimelineConnector,
  type TimelineConnectorProps as MuiTimelineConnectorProps
} from '@mui/lab';

export interface TimelineConnectorProps extends MuiTimelineConnectorProps { }

export const TimelineConnector = ({ ...props }: TimelineConnectorProps) => {
  return <MuiTimelineConnector {...props} />;
};

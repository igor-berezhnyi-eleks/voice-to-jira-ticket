import {
  AccordionSummary as MuiAccordionSummary,
  type AccordionSummaryProps as MuiAccordionSummaryProps,
  AccordionDetails as MuiAccordionDetails,
  type AccordionDetailsProps as MuiAccordionDetailsProps
} from '@mui/material';

export interface AccordionSummaryProps extends MuiAccordionSummaryProps { }

export const AccordionSummary = ({
  children,
  ...props
}: AccordionSummaryProps) => {
  return <MuiAccordionSummary {...props}>{children}</MuiAccordionSummary>;
};

export interface AccordionDetailsProps extends MuiAccordionDetailsProps { }

export const AccordionDetails = ({
  children,
  ...props
}: AccordionDetailsProps) => {
  return <MuiAccordionDetails {...props}>{children}</MuiAccordionDetails>;
};

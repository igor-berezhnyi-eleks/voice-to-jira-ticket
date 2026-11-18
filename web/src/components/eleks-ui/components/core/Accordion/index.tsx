import {
  Accordion as MuiAccordion,
  type AccordionProps as MuiAccordionProps
} from '@mui/material';

export interface AccordionProps extends MuiAccordionProps { }

export const Accordion = ({ children, ...props }: AccordionProps) => {
  return <MuiAccordion {...props}>{children}</MuiAccordion>;
};

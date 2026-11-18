import React from 'react';
import { Box, type BoxProps } from '../BoxSet';
import { type AccordionProps } from '../Accordion';

export interface AccordionGroupProps extends BoxProps {
  /** Array of Accordion components to display in the group */
  children?: React.ReactElement<AccordionProps>[];
}

export const AccordionGroup = ({ children, ...props }: AccordionGroupProps) => {
  return <Box {...props}>{children}</Box>;
};

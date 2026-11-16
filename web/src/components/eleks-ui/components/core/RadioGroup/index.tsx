import {
  RadioGroup as MuiRadioGroup,
  type RadioGroupProps as MuiRadioGroupProps
} from '@mui/material';

export interface RadioGroupProps extends MuiRadioGroupProps {}

export const RadioGroup = ({ children, ...rest }: RadioGroupProps) => {
  return <MuiRadioGroup {...rest}>{children}</MuiRadioGroup>;
};

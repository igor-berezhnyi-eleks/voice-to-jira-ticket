import {
  Stepper as MuiStepper,
  type StepperProps as MuiStepperProps
} from '@mui/material';

export interface StepperProps extends MuiStepperProps {
  children: React.ReactNode;
}

export const Stepper = ({ children, ...props }: StepperProps) => {
  return <MuiStepper {...props}>{children}</MuiStepper>;
};

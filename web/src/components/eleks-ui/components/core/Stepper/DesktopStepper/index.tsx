import { Stepper, type StepperProps } from '../index';

export const DesktopStepper = ({ children, ...props }: StepperProps) => {
  return <Stepper {...props}>{children}</Stepper>;
};

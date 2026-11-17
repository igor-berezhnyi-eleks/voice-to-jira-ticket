import {
  MobileStepper as MuiMobileStepper,
  type MobileStepperProps as MuiMobileStepperProps
} from '@mui/material';

export interface MobileStepperProps extends MuiMobileStepperProps { }

export const MobileStepper = ({ ...props }: MobileStepperProps) => {
  return <MuiMobileStepper {...props} />;
};

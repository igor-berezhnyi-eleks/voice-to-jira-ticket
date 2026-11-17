import {
  Step as MuiStep,
  type StepProps as MuiStepProps,
  StepLabel as MuiStepLabel,
  type StepLabelProps as MuiStepLabelProps
} from '@mui/material';

export interface StepProps extends MuiStepProps {
  children: React.ReactNode;
}

export const Step = ({ children, ...props }: StepProps) => {
  return <MuiStep {...props}>{children}</MuiStep>;
};

export interface StepLabelProps extends MuiStepLabelProps { }

export const StepLabel = ({ ...props }: StepLabelProps) => {
  return <MuiStepLabel {...props} />;
};

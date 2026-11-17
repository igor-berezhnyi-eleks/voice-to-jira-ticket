import {
  Radio as MuiRadio,
  type RadioProps as MuiRadioProps
} from '@mui/material';

export interface RadioProps extends MuiRadioProps {}

export const Radio = ({ ...props }: RadioProps) => {
  return <MuiRadio {...props} />;
};

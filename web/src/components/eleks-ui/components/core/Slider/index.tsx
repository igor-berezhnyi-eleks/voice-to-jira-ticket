import {
  Slider as MuiSlider,
  type SliderProps as MuiSliderProps
} from '@mui/material';

export interface SliderProps extends MuiSliderProps {}

export const Slider = ({ ...props }: SliderProps) => {
  return <MuiSlider {...props} />;
};

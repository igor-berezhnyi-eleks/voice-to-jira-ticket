import {
  Checkbox as MuiCheckbox,
  type CheckboxProps as MuiCheckboxProps
} from '@mui/material';

export interface CheckboxProps extends MuiCheckboxProps {
  label?: string;
}

export const Checkbox = ({ ...rest }: CheckboxProps) => {
  return <MuiCheckbox {...rest} />;
};

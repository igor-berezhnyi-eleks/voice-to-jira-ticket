import {
  OutlinedInput as MuiOutlinedInput,
  type OutlinedInputProps as MuiOutlinedInputProps
} from '@mui/material';

export interface OutlinedInputProps extends MuiOutlinedInputProps {}

export const OutlinedInput = ({ ...props }: OutlinedInputProps) => {
  return <MuiOutlinedInput {...props} />;
};

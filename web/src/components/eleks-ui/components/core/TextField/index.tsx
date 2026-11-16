import {
  TextField as MuiTextField,
  type TextFieldProps as MuiTextFieldProps,
  InputBase as MuiInputBase,
  type InputBaseProps as MuiInputBaseProps
} from '@mui/material';

export type TextFieldProps = MuiTextFieldProps;

export const TextField = ({ ...props }: TextFieldProps) => {
  return <MuiTextField {...props} />;
};

export interface InputBaseProps extends MuiInputBaseProps { }

export const InputBase = ({ ...props }: InputBaseProps) => {
  return <MuiInputBase {...props} />;
};

import {
  TextField as MuiTextField,
  type BaseTextFieldProps
} from '@mui/material';

export interface TextFieldProps extends BaseTextFieldProps {}

export const TextField = ({ ...props }: TextFieldProps) => {
  return <MuiTextField {...props} />;
};

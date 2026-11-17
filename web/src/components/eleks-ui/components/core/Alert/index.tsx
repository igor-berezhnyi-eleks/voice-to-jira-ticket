import {
  Alert as MuiAlert,
  AlertTitle,
  type AlertProps as MuiAlertProps
} from '@mui/material';

export interface AlertProps extends MuiAlertProps {
  children?: React.ReactNode;
  title?: string;
}

export const Alert = ({ children, title, ...props }: AlertProps) => {
  const alertTitle = title ? <AlertTitle>{title}</AlertTitle> : null;

  return (
    <MuiAlert {...props}>
      {alertTitle}
      {children}
    </MuiAlert>
  );
};

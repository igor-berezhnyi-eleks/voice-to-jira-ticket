import {
  Dialog as MuiDialog,
  type DialogProps as MuiDialogProps,
  DialogTitle as MuiDialogTitle,
  type DialogTitleProps as MuiDialogTitleProps,
  DialogContent as MuiDialogContent,
  DialogContentText as MuiDialogContentText,
  type DialogContentTextProps as MuiDialogContentTextProps,
  type DialogContentProps as MuiDialogContentProps,
  DialogActions as MuiDialogActions,
  type DialogActionsProps as MuiDialogActionsProps
} from '@mui/material';

export interface DialogProps extends MuiDialogProps {
  children: React.ReactNode;
}

export interface DialogTitleProps extends MuiDialogTitleProps {
  children: React.ReactNode;
}

export interface DialogContentProps extends MuiDialogContentProps {
  children: React.ReactNode;
}

export interface DialogContentTextProps extends MuiDialogContentTextProps {
  children: React.ReactNode;
}

export interface DialogActionsProps extends MuiDialogActionsProps {
  children: React.ReactNode;
}

export const DialogActions = ({ children, ...rest }: DialogActionsProps) => {
  return <MuiDialogActions {...rest}>{children}</MuiDialogActions>;
};

export const DialogContent = ({ children, ...rest }: DialogContentProps) => {
  return <MuiDialogContent {...rest}>{children}</MuiDialogContent>;
};

export const DialogContentText = ({
  children,
  ...rest
}: DialogContentTextProps) => {
  return <MuiDialogContentText {...rest}>{children}</MuiDialogContentText>;
};

export const DialogTitle = ({ children, ...rest }: DialogTitleProps) => {
  return <MuiDialogTitle {...rest}>{children}</MuiDialogTitle>;
};

export const Dialog = ({ children, ...rest }: DialogProps) => {
  return <MuiDialog {...rest}>{children}</MuiDialog>;
};

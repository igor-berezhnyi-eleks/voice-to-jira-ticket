import {
  Modal as MuiModal,
  type ModalProps as MuiModalProps
} from '@mui/material';

export interface ModalProps extends MuiModalProps {}

export const Modal = ({ children, ...props }: ModalProps) => {
  return <MuiModal {...props}>{children}</MuiModal>;
};

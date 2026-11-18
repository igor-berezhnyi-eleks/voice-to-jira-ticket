import {
  ImageList as MuiImageList,
  type ImageListProps as MuiImageListProps
} from '@mui/material';

export interface ImageListProps extends MuiImageListProps {}

export const ImageList = ({ children, ...props }: ImageListProps) => {
  return <MuiImageList {...props}>{children}</MuiImageList>;
};

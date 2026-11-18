import {
  ImageListItem as MuiImageListItem,
  type ImageListItemProps as MuiImageListItemProps,
  ImageListItemBar as MuiImageListItemBar,
  type ImageListItemBarProps as MuiImageListItemBarProps
} from '@mui/material';

export interface ImageListItemProps extends MuiImageListItemProps { }

export const ImageListItem = ({ children, ...props }: ImageListItemProps) => {
  return <MuiImageListItem {...props}>{children}</MuiImageListItem>;
};

export interface ImageListItemBarProps extends MuiImageListItemBarProps { }

export const ImageListItemBar = ({ ...props }: ImageListItemBarProps) => {
  return <MuiImageListItemBar {...props} />;
};

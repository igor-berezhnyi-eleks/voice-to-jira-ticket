import {
  AvatarGroup as MuiAvatarGroup,
  type AvatarGroupProps as MuiAvatarGroupProps
} from '@mui/material';

export interface AvatarGroupProps extends MuiAvatarGroupProps {}

export const AvatarGroup = ({ children, ...props }: AvatarGroupProps) => {
  return <MuiAvatarGroup {...props}>{children}</MuiAvatarGroup>;
};

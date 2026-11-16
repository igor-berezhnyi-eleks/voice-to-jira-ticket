import {
  Chip as MuiChip,
  type ChipProps as MuiChipProps
} from '@mui/material';

export interface ChipProps extends MuiChipProps {
  label?: string;
}

export const Chip = ({ label, ...rest }: ChipProps) => {
  return <MuiChip label={label} {...rest} />;
};

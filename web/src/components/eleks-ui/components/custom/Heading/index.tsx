import {
  Box,
  Divider,
  Stack,
  Typography,
  type SxProps,
  type Theme
} from '@mui/material';

// Heading Component
interface HeadingProps {
  /** Heading variant - determines the typography variant */
  variant?: 'page' | 'section';
  /** Main heading title text */
  title: string;
  /** Optional subtitle to display below the title */
  subtitle?: string;
  /** Optional breadcrumbs to display above the title (only for page variant) */
  breadcrumbs?: React.ReactNode;
  /** Optional action buttons to display on the right side of the title */
  actions?: React.ReactNode;
  /** Optional actions bottom content to display below the title or subtitle (if present) */
  actionsBottom?: React.ReactNode;
  /** Show divider at the bottom */
  divider?: boolean;
  /** Custom styles using MUI sx prop */
  sx?: SxProps<Theme>;
}

export const Heading = ({
  variant = 'page',
  title,
  subtitle,
  breadcrumbs,
  actions,
  actionsBottom,
  divider = false,
  sx
}: HeadingProps) => {
  const typographyVariant = variant === 'page' ? 'h4' : 'h5';

  return (
    <Stack
      data-testid="Heading"
      spacing={1}
      sx={{
        ...sx
      }}
    >
      {breadcrumbs && variant === 'page' && <>{breadcrumbs}</>}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant={typographyVariant}>{title}</Typography>
        {actions}
      </Box>

      {subtitle}

      {actionsBottom && <Box sx={{ display: 'flex' }}>{actionsBottom}</Box>}

      {divider && <Divider />}
    </Stack>
  );
};

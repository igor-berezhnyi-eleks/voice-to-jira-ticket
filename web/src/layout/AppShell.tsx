import type { ReactNode } from 'react';
import { Box, Paper } from '@eleks-ui/components';
import { PageHeader } from './PageHeader';

interface AppShellProps {
  /** 0 Report, 1 Review, 2 Jira. */
  activeStep: number;
  children: ReactNode;
}

/** The frame every page shares: tinted backdrop, the header with progress and theme toggle, then the page. */
export function AppShell({ activeStep, children }: AppShellProps) {
  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          bgcolor: (theme) => (theme.palette.mode === 'light' ? '#F5F7FA' : '#0A0A0A'),
        }}
      />
      <PageHeader activeStep={activeStep} />
      {children}
    </>
  );
}

/** The raised card a page's content sits on. */
export function PageCard({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {children}
    </Paper>
  );
}

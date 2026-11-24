import type { ReactNode } from 'react';
import { Box, Paper } from '@eleks-ui/components';
import { PageHeader, type StepState } from './PageHeader';

interface AppShellProps {
  /** 0 Report, 1 Review, 2 Jira. */
  activeStep: number;
  /** What each header step can do now; with `onStep`, the other steps are clickable. */
  steps?: StepState[];
  onStep?: (step: number) => void;
  children: ReactNode;
}

/** The frame every page shares: tinted backdrop, the header with progress and theme toggle, then the page. */
export function AppShell({ activeStep, steps, onStep, children }: AppShellProps) {
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
      <PageHeader activeStep={activeStep} steps={steps} onStep={onStep} />
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

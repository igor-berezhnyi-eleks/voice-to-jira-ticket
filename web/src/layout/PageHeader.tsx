import { StepButton } from '@mui/material';
import { Box, Step, StepLabel, Stepper, Typography } from '@eleks-ui/components';
import { useT } from '../i18n/LanguageProvider';
import { LanguageSelect } from './LanguageSelect';
import { ThemeToggle } from './ThemeToggle';

/** Whether a header step can be used now, and why not. Index 0 Report, 1 Review, 2 Jira. */
export interface StepState {
  disabled: boolean;
  /** Shown as the tooltip of a disabled step: the same text as the matching button's. */
  reason?: string;
}

/** What a page tells the app shell: its step states and what a click on a step does. */
export interface PageNavigation {
  steps: StepState[];
  go: (step: number) => void;
}

/** Equal when every step has the same disabled flag and reason (the shell keeps the old array then). */
export function sameSteps(a: StepState[] | undefined, b: StepState[]): boolean {
  return a !== undefined && a.length === b.length && a.every((step, i) => step.disabled === b[i].disabled && step.reason === b[i].reason);
}

interface PageHeaderProps {
  activeStep: number;
  /** One entry per step; the current step's entry is ignored. Absent: the steps are not clickable. */
  steps?: StepState[];
  onStep?: (step: number) => void;
}

export function PageHeader({ activeStep, steps, onStep }: PageHeaderProps) {
  const t = useT();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
      <Typography component="p" variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
        {t.appName}
      </Typography>
      {/* nonLinear: a linear Stepper would disable every step after the current one by itself. */}
      {/* The connector line only fills spare width, so it gets a minimum or wider step buttons squeeze it to nothing. */}
      <Stepper
        nonLinear
        activeStep={activeStep}
        sx={{ minWidth: { sm: 320 }, '& .MuiStepConnector-root': { minWidth: 40 } }}
        aria-label={t.progress}
      >
        {t.steps.map((label, index) => {
          const state = steps?.[index];
          const clickable = index !== activeStep && state !== undefined && onStep !== undefined;
          return (
            <Step key={label} completed={index < activeStep} disabled={clickable && state.disabled}>
              {clickable ? (
                // A disabled button takes no pointer events, so the reason sits on a wrapper that does.
                <Box component="span" title={state.disabled ? state.reason : undefined} sx={{ display: 'inline-flex' }}>
                  <StepButton
                    onClick={() => onStep(index)}
                    sx={{
                      // MUI's own padding is offset by a negative margin; keep that on the sides so the step
                      // takes the label's width, and drop it top and bottom so the header keeps its height.
                      my: 0,
                      py: 1,
                      mx: -1,
                      px: 1,
                      // MUI draws an enabled and a disabled step alike; dim the disabled one, underline on hover.
                      '&.Mui-disabled': { opacity: 0.45 },
                      '&:hover .MuiStepLabel-label, &.Mui-focusVisible .MuiStepLabel-label': { textDecoration: 'underline' },
                    }}
                  >
                    {label}
                  </StepButton>
                </Box>
              ) : (
                <StepLabel aria-current={index === activeStep ? 'step' : undefined}>{label}</StepLabel>
              )}
            </Step>
          );
        })}
      </Stepper>
      <LanguageSelect />
      <ThemeToggle />
    </Box>
  );
}

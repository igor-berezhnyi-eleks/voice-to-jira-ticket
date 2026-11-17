import { Box, Step, StepLabel, Stepper, Typography } from '@eleks-ui/components';
import { ThemeToggle } from './ThemeToggle';

const steps = ['Report', 'Review', 'Jira'];

export function PageHeader({ activeStep }: { activeStep: number }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
      <Typography component="p" variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
        Voice to Ticket
      </Typography>
      <Stepper activeStep={activeStep} sx={{ minWidth: { sm: 320 } }} aria-label="Progress">
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <ThemeToggle />
    </Box>
  );
}

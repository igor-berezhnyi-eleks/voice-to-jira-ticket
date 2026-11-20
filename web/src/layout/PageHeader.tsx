import { Box, Step, StepLabel, Stepper, Typography } from '@eleks-ui/components';
import { useT } from '../i18n/LanguageProvider';
import { LanguageSelect } from './LanguageSelect';
import { ThemeToggle } from './ThemeToggle';

export function PageHeader({ activeStep }: { activeStep: number }) {
  const t = useT();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
      <Typography component="p" variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
        {t.appName}
      </Typography>
      <Stepper activeStep={activeStep} sx={{ minWidth: { sm: 320 } }} aria-label={t.progress}>
        {t.steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <LanguageSelect />
      <ThemeToggle />
    </Box>
  );
}

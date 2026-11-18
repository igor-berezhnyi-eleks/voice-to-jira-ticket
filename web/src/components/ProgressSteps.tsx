import { Fragment } from 'react'
import { Box, Typography } from '@eleks-ui/components'
import ButtonBase from '@mui/material/ButtonBase'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'

export interface ProgressStep {
  title: string
}

interface Props {
  steps: ProgressStep[]
  current: number
  onNavigate: (index: number) => void
}

export function ProgressSteps({ steps, current, onNavigate }: Props) {
  return (
    <Box component="nav" aria-label="Progress" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', mb: 3 }}>
      {steps.map((step, index) => {
        const passed = index < current
        const active = index === current
        return (
          <Fragment key={step.title}>
            {index > 0 && <ArrowForwardIcon sx={{ mt: 1, mx: 2, color: 'text.secondary' }} />}
            <ButtonBase
              disabled={!passed}
              onClick={() => onNavigate(index)}
              aria-current={active ? 'step' : undefined}
              sx={{ flexDirection: 'column', gap: 0.5, borderRadius: 1, p: 0.5, '&.Mui-disabled': { opacity: 1 } }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 2,
                  borderColor: passed || active ? 'primary.main' : 'text.disabled',
                  bgcolor: passed ? 'primary.main' : 'transparent',
                  color: passed ? 'primary.contrastText' : active ? 'primary.main' : 'text.disabled',
                  fontWeight: 600,
                }}
              >
                {passed ? <CheckIcon fontSize="small" /> : index + 1}
              </Box>
              <Typography variant="body2" sx={{ color: passed || active ? 'text.primary' : 'text.disabled', fontWeight: active ? 600 : 400 }}>
                {step.title}
              </Typography>
            </ButtonBase>
          </Fragment>
        )
      })}
    </Box>
  )
}

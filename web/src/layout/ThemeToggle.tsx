import { useContext } from 'react';
import { IconButton, Tooltip } from '@eleks-ui/components';
import { EleksUIThemeContext } from '@eleks-ui/theme';
import { useT } from '../i18n/LanguageProvider';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

// Renders nothing without a theme provider (the component tests mount pages on their own).
export function ThemeToggle() {
  const t = useT();
  const theme = useContext(EleksUIThemeContext);
  if (!theme) {
    return null;
  }
  const label = theme.mode === 'dark' ? t.switchToLight : t.switchToDark;
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={theme.toggleTheme}>
        {theme.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

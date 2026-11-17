import { useContext } from 'react';
import { IconButton, Tooltip } from '@eleks-ui/components';
import { EleksUIThemeContext } from '@eleks-ui/theme';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

// Renders nothing without a theme provider (the component tests mount pages on their own).
export function ThemeToggle() {
  const theme = useContext(EleksUIThemeContext);
  if (!theme) {
    return null;
  }
  const label = theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={theme.toggleTheme}>
        {theme.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

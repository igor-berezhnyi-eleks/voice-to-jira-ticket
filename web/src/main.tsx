import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EleksUIThemeProvider } from '@eleks-ui/theme';
import { App } from './App';
import { LanguageProvider } from './i18n/LanguageProvider';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html has no #root element.');
}

createRoot(root).render(
  <StrictMode>
    <EleksUIThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </EleksUIThemeProvider>
  </StrictMode>,
);

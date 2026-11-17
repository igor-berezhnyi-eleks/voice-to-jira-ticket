import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EleksUIThemeProvider } from '@eleks-ui/theme';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html has no #root element.');
}

createRoot(root).render(
  <StrictMode>
    <EleksUIThemeProvider>
      <App />
    </EleksUIThemeProvider>
  </StrictMode>,
);

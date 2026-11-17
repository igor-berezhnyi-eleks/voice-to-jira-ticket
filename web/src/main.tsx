import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EleksUIThemeProvider } from '@eleks-ui/theme'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EleksUIThemeProvider>
      <App />
    </EleksUIThemeProvider>
  </StrictMode>,
)

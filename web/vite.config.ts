import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs on its launchSettings port; Vite proxies /api to it.
export default defineConfig({
  plugins: [react()],
  // The STT worker is a module worker (Transformers.js uses dynamic imports).
  worker: { format: 'es' },
  server: {
    proxy: {
      '/api': 'http://localhost:5080',
    },
  },
})

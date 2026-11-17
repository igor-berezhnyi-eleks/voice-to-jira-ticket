import path from 'path'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log(path.resolve(__dirname, "src/components/eleks-ui/components"));

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
  resolve: {
    alias: {
 
      "@eleks-ui/components": path.resolve(__dirname, "src/components/eleks-ui/components"),
 
      "@eleks-ui/theme": path.resolve(__dirname, "src/components/eleks-ui/theme"),
 
    },
  },
})

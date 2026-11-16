import path from 'path'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API's development address, from src/VoiceToTicket.Api/Properties/launchSettings.json.
const apiUrl = 'http://localhost:5080';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log(path.resolve(__dirname, "src/components/eleks-ui/components"));

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiUrl,
      '/health': apiUrl,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      "@eleks-ui/components": path.resolve(__dirname, "src/components/eleks-ui/components"),
      "@eleks-ui/theme": path.resolve(__dirname, "src/components/eleks-ui/theme"),
    }
  },
});

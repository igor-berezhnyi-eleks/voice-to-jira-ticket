import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API's development address, from src/VoiceToTicket.Api/Properties/launchSettings.json.
const apiUrl = 'http://localhost:5080';

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
});

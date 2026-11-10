import { defineConfig, devices } from '@playwright/test';

const webUrl = 'http://localhost:5173';
const apiUrl = 'http://localhost:5080';
const reuse = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] },
    },
  ],
  webServer: [
    {
      // The API with the fake generator forced, so user-secrets cannot switch the test to Claude.
      command: 'dotnet run --project src/VoiceToTicket.Api/VoiceToTicket.Api.csproj',
      cwd: '..',
      url: `${apiUrl}/health`,
      env: { ASPNETCORE_URLS: apiUrl, TicketGenerator__Provider: 'Fake' },
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: webUrl,
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
  ],
});

import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', testIgnore: /online\.spec\.js/, timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3123', headless: true },
  webServer: { command: 'node server.js', url: 'http://127.0.0.1:3123/health', env: { PORT: '3123' }, reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }]
});

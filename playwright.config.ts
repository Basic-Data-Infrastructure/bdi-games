import { defineConfig, devices } from '@playwright/test'

const web = process.env.WEB_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: web,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.WEB_URL ? undefined : [
    { command: 'npm run dev:api', url: 'http://localhost:8787/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev', url: web, reuseExistingServer: true, timeout: 60_000 },
  ],
})

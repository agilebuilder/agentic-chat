import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/quality',
  outputDir: '.tmp/playwright-quality',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: {
    // Windows and Linux Chromium rasterize the same system-font layout slightly differently.
    // Keep one reviewed baseline while still rejecting visual changes above the observed 1-2% noise.
    toHaveScreenshot: { maxDiffPixelRatio: 0.025 },
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:6007',
    browserName: 'chromium',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  webServer: [
    {
      command: 'pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort',
      cwd: 'apps/storybook',
      url: 'http://127.0.0.1:6007/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 6008 --strictPort',
      cwd: 'apps/fixture-player',
      url: 'http://127.0.0.1:6008',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})

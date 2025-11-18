import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright Configuration for DataApp E2E Tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Maximum time one test can run for
  timeout: 60 * 1000,

  // Test execution settings
  fullyParallel: false, // Run tests sequentially for saved plots (they modify DB state)
  forbidOnly: !!process.env.CI, // Fail build if test.only() is committed
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: 1, // Single worker to avoid conflicts

  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.BASE_URL || 'http://localhost:9002',

    // Browser context options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Web server configuration (start dev server before tests)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9002',
    timeout: 120 * 1000,
    reuseExistingServer: true, // Always reuse existing server
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

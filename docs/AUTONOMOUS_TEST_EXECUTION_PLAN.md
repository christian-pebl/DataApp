# Autonomous Test Execution Plan
## Self-Guided Testing Implementation with Claude Code

**Purpose:** Execute the comprehensive testing strategy autonomously with detailed documentation at each step.

**Mode:** Dangerously Skip Permission Mode (for autonomous execution)

**Duration:** Estimated 8-10 hours of autonomous work

**Output:** Complete test infrastructure + detailed execution reports

---

## Execution Overview

This plan is designed to be executed by Claude Code in autonomous mode, with checkpoints for documentation and validation at each major step.

### Execution Phases:
1. **Phase 1:** Environment Setup & Dependencies (60 min)
2. **Phase 2:** Unit Testing Infrastructure (90 min)
3. **Phase 3:** E2E Testing Setup (90 min)
4. **Phase 4:** Initial Test Suite Creation (120 min)
5. **Phase 5:** Performance Testing Setup (60 min)
6. **Phase 6:** CI/CD Pipeline Configuration (45 min)
7. **Phase 7:** Test Execution & Documentation (90 min)
8. **Phase 8:** Report Generation & Next Steps (30 min)

---

## Pre-Execution Checklist

**Before starting autonomous execution:**
- [ ] Development server is running (localhost:9002)
- [ ] Production deployment is live (https://data-app-gamma.vercel.app)
- [ ] Git is clean or ready for new branch
- [ ] User has approved autonomous mode execution

---

## Phase 1: Environment Setup & Dependencies

**Objective:** Install and configure all testing dependencies

**Estimated Time:** 60 minutes

### Step 1.1: Create Test Branch
```bash
git checkout -b testing/automated-test-infrastructure
```

**Documentation Point:** Log branch creation

### Step 1.2: Install Core Testing Dependencies
```bash
npm install --save-dev @playwright/test @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
```

**Documentation Point:** Log installed versions

### Step 1.3: Install Additional Testing Tools
```bash
npm install --save-dev @types/jest ts-jest identity-obj-proxy
```

### Step 1.4: Install Performance Testing Tools
```bash
npm install --save-dev lighthouse @lhci/cli
```

### Step 1.5: Create Test Directory Structure
```bash
mkdir -p tests/e2e
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p tests/visual
mkdir -p tests/fixtures/csv
mkdir -p tests/fixtures/geojson
mkdir -p tests/helpers
mkdir -p test-results
mkdir -p test-reports
```

**Documentation Point:** Create `test-execution-log.md` in `test-reports/`

### Step 1.6: Verification
- Check all directories created
- Verify package.json updated
- Document any installation errors

**Checkpoint:** Create `test-reports/phase1-environment-setup.md`

---

## Phase 2: Unit Testing Infrastructure

**Objective:** Set up Jest and React Testing Library

**Estimated Time:** 90 minutes

### Step 2.1: Create Jest Configuration
**File:** `jest.config.js`

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
  ],
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{js,jsx,ts,tsx}',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

**Documentation Point:** Log Jest configuration created

### Step 2.2: Create Jest Setup File
**File:** `jest.setup.js`

```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock Leaflet
global.L = {
  map: jest.fn(),
  tileLayer: jest.fn(),
  marker: jest.fn(),
  icon: jest.fn(),
}
```

### Step 2.3: Create First Unit Test (CSV Parser)
**File:** `tests/unit/csvParser.test.ts`

```typescript
import { describe, test, expect } from '@jest/globals'

// Mock implementation for initial test
const parseSimpleCSV = (csv: string) => {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const obj: any = {}
    headers.forEach((header, i) => {
      obj[header] = values[i]
    })
    return obj
  })
}

describe('CSV Parser', () => {
  test('should parse simple CSV data', () => {
    const csv = 'Name,Age\nJohn,30\nJane,25'
    const result = parseSimpleCSV(csv)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ Name: 'John', Age: '30' })
    expect(result[1]).toEqual({ Name: 'Jane', Age: '25' })
  })

  test('should handle empty CSV', () => {
    const csv = 'Name,Age'
    const result = parseSimpleCSV(csv)

    expect(result).toHaveLength(0)
  })
})
```

### Step 2.4: Update package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Step 2.5: Run First Test
```bash
npm run test:unit
```

**Documentation Point:** Log test results in `test-reports/phase2-unit-testing-setup.md`

**Checkpoint:** Verify Jest is working, document any issues

---

## Phase 3: E2E Testing Setup (Playwright)

**Objective:** Configure Playwright for end-to-end testing

**Estimated Time:** 90 minutes

### Step 3.1: Install Playwright Browsers
```bash
npx playwright install chromium firefox webkit
```

### Step 3.2: Create Playwright Configuration
**File:** `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  reporter: [
    ['html', { outputFolder: 'test-reports/playwright-html' }],
    ['json', { outputFile: 'test-reports/playwright-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:9002',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9002',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
```

### Step 3.3: Create First E2E Test (Basic Navigation)
**File:** `tests/e2e/basic-navigation.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Basic Navigation', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check page title or main element
    const title = await page.title()
    expect(title).toBeTruthy()

    console.log('✓ Homepage loaded successfully')
  })

  test('should navigate to map-drawing page', async ({ page }) => {
    await page.goto('/map-drawing')

    // Wait for map to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give map time to initialize

    // Check for map container
    const mapContainer = page.locator('.leaflet-container')
    await expect(mapContainer).toBeVisible({ timeout: 10000 })

    console.log('✓ Map page loaded successfully')
  })
})
```

### Step 3.4: Create Test Helpers
**File:** `tests/helpers/test-utils.ts`

```typescript
import { Page } from '@playwright/test'

export async function waitForMapLoad(page: Page) {
  await page.waitForSelector('.leaflet-container', { timeout: 10000 })
  await page.waitForTimeout(1000) // Allow map to stabilize
}

export async function takeScreenshotWithTimestamp(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({
    path: `test-reports/screenshots/${name}-${timestamp}.png`,
    fullPage: true
  })
}

export async function logConsoleMessages(page: Page) {
  const messages: string[] = []

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    messages.push(text)
    console.log(text)
  })

  return messages
}
```

### Step 3.5: Update package.json Scripts
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report test-reports/playwright-html"
  }
}
```

### Step 3.6: Run First E2E Test
```bash
npm run test:e2e
```

**Documentation Point:** Log E2E test results in `test-reports/phase3-e2e-setup.md`

**Checkpoint:** Verify Playwright working, capture screenshots

---

## Phase 4: Initial Test Suite Creation

**Objective:** Create comprehensive test suites for critical functionality

**Estimated Time:** 120 minutes

### Step 4.1: Create CSV Parser Unit Tests
**File:** `tests/unit/csvParser.test.ts` (expand existing)

```typescript
describe('CSV Parser - Date Handling', () => {
  test('should parse DD/MM/YYYY format', () => {
    // Implementation based on actual csvParser.ts
  })

  test('should detect date format automatically', () => {
    // Implementation
  })

  test('should handle 2-digit years', () => {
    // Implementation
  })
})
```

### Step 4.2: Create Map Component Tests
**File:** `tests/e2e/map-interaction.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import { waitForMapLoad } from '../helpers/test-utils'

test.describe('Map Interactions', () => {
  test('should initialize map with correct view', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    // Verify map is interactive
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible()

    // Check zoom controls
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible()

    console.log('✓ Map initialized successfully')
  })

  test('should handle map panning', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    // Get initial map state
    const mapContainer = page.locator('.leaflet-container')
    const box = await mapContainer.boundingBox()

    if (box) {
      // Pan map
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100)
      await page.mouse.up()

      console.log('✓ Map panning tested')
    }
  })
})
```

### Step 4.3: Create Authentication Tests
**File:** `tests/e2e/authentication.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto('/map-drawing')

    // Check if redirected to login or shows auth UI
    await page.waitForLoadState('networkidle')

    const url = page.url()
    console.log('Current URL:', url)

    // Document authentication state
    const hasAuthUI = await page.locator('[data-testid="auth-ui"]').isVisible().catch(() => false)
    console.log('Has Auth UI:', hasAuthUI)
  })
})
```

### Step 4.4: Create Test Fixtures
**File:** `tests/fixtures/csv/sample-data.csv`

```csv
Date,Parameter,Value,Unit
01/01/2024,Temperature,25.5,°C
02/01/2024,Temperature,26.1,°C
03/01/2024,Temperature,24.8,°C
```

**File:** `tests/fixtures/csv/sample-hapl.csv`

```csv
Site,Species,Count
Site1,Species A,10
Site1,Species B,5
Site2,Species A,8
Site2,Species C,3
```

### Step 4.5: Run All Unit Tests
```bash
npm run test:unit -- --verbose
```

### Step 4.6: Run All E2E Tests
```bash
npm run test:e2e
```

**Documentation Point:** Create comprehensive report in `test-reports/phase4-test-suite-results.md`

**Checkpoint:** Document test coverage, failures, and insights

---

## Phase 5: Performance Testing Setup

**Objective:** Configure Lighthouse and performance monitoring

**Estimated Time:** 60 minutes

### Step 5.1: Create Lighthouse Configuration
**File:** `lighthouse-budget.json`

```json
{
  "path": "/*",
  "timings": [
    {
      "metric": "interactive",
      "budget": 5000,
      "tolerance": 1000
    },
    {
      "metric": "first-contentful-paint",
      "budget": 2000,
      "tolerance": 500
    }
  ],
  "resourceSizes": [
    {
      "resourceType": "script",
      "budget": 400
    },
    {
      "resourceType": "total",
      "budget": 1000
    }
  ]
}
```

### Step 5.2: Create Lighthouse Test Script
**File:** `scripts/run-lighthouse.js`

```javascript
const lighthouse = require('lighthouse')
const chromeLauncher = require('chrome-launcher')
const fs = require('fs')

async function runLighthouse() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] })

  const options = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
  }

  const runnerResult = await lighthouse('http://localhost:9002', options)

  // Save report
  const reportHtml = runnerResult.report
  fs.writeFileSync('test-reports/lighthouse-report.html', reportHtml)

  // Log scores
  console.log('Performance Score:', runnerResult.lhr.categories.performance.score * 100)
  console.log('Accessibility Score:', runnerResult.lhr.categories.accessibility.score * 100)
  console.log('Best Practices Score:', runnerResult.lhr.categories['best-practices'].score * 100)
  console.log('SEO Score:', runnerResult.lhr.categories.seo.score * 100)

  await chrome.kill()
}

runLighthouse().catch(console.error)
```

### Step 5.3: Create Performance Test
**File:** `tests/e2e/performance.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('should measure page load time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/map-drawing')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime
    console.log(`Page load time: ${loadTime}ms`)

    // Log performance metrics
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        totalTime: perf.loadEventEnd - perf.fetchStart,
      }
    })

    console.log('Performance Metrics:', JSON.stringify(metrics, null, 2))

    // Document in report
    expect(loadTime).toBeLessThan(10000) // 10 second max for initial load
  })

  test('should measure time to interactive', async ({ page }) => {
    await page.goto('/map-drawing')

    const tti = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve(performance.now())
        } else {
          window.addEventListener('load', () => {
            resolve(performance.now())
          })
        }
      })
    })

    console.log(`Time to Interactive: ${tti}ms`)
  })
})
```

### Step 5.4: Update package.json
```json
{
  "scripts": {
    "test:performance": "playwright test tests/e2e/performance.spec.ts",
    "lighthouse": "node scripts/run-lighthouse.js"
  }
}
```

### Step 5.5: Run Performance Tests
```bash
npm run test:performance
```

**Documentation Point:** Create `test-reports/phase5-performance-results.md`

**Checkpoint:** Document performance metrics and bottlenecks

---

## Phase 6: CI/CD Pipeline Configuration

**Objective:** Set up GitHub Actions for automated testing

**Estimated Time:** 45 minutes

### Step 6.1: Create GitHub Actions Workflow
**File:** `.github/workflows/test.yml`

```yaml
name: Automated Tests

on:
  push:
    branches: [ main, master, testing/** ]
  pull_request:
    branches: [ main, master ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:9002

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-reports/
          retention-days: 30
```

### Step 6.2: Create Pre-commit Hook Script
**File:** `.husky/pre-commit` (if using Husky)

```bash
#!/bin/sh
npm run test:unit -- --bail --findRelatedTests
```

### Step 6.3: Document CI/CD Setup
**File:** `test-reports/phase6-cicd-configuration.md`

**Documentation Point:** Log CI/CD configuration details

---

## Phase 7: Test Execution & Documentation

**Objective:** Run comprehensive test suite and document results

**Estimated Time:** 90 minutes

### Step 7.1: Run Full Test Suite
```bash
# Run all unit tests with coverage
npm run test:unit -- --coverage --verbose > test-reports/unit-test-output.txt 2>&1

# Run all E2E tests
npm run test:e2e > test-reports/e2e-test-output.txt 2>&1

# Run performance tests
npm run test:performance > test-reports/performance-test-output.txt 2>&1
```

### Step 7.2: Capture Screenshots
```bash
# Take screenshots of test results
# These will be automatically captured by Playwright on failures
```

### Step 7.3: Generate Coverage Report
```bash
npm run test:coverage
# Coverage report will be in ./coverage/lcov-report/index.html
```

### Step 7.4: Analyze Results
**Create:** `test-reports/phase7-comprehensive-test-results.md`

**Include:**
- Total tests run
- Pass/fail breakdown
- Coverage percentages
- Performance metrics
- Identified issues
- Recommended fixes

### Step 7.5: Create Test Summary Dashboard
**File:** `test-reports/TEST-SUMMARY.md`

```markdown
# Test Execution Summary

**Date:** [AUTO-GENERATED]
**Total Execution Time:** [AUTO-CALCULATED]

## Overview
- Total Tests: XX
- Passed: XX
- Failed: XX
- Skipped: XX

## Coverage
- Overall: XX%
- Statements: XX%
- Branches: XX%
- Functions: XX%
- Lines: XX%

## Performance Metrics
- Average Page Load: XXXms
- Lighthouse Performance Score: XX/100
- Time to Interactive: XXXms

## Critical Issues
[AUTO-POPULATED FROM FAILURES]

## Recommendations
[AUTO-GENERATED]
```

**Documentation Point:** Create comprehensive summary

---

## Phase 8: Report Generation & Next Steps

**Objective:** Generate final reports and recommendations

**Estimated Time:** 30 minutes

### Step 8.1: Create Final Execution Report
**File:** `test-reports/FINAL-EXECUTION-REPORT.md`

Include:
- Executive summary
- All test results
- Performance analysis
- Code coverage analysis
- Issues found
- Recommended next steps
- Estimated effort for fixes

### Step 8.2: Generate Visual Reports
```bash
# Generate HTML coverage report
npm run test:coverage

# Generate Playwright HTML report
npm run test:e2e:report
```

### Step 8.3: Create Issue List
**File:** `test-reports/ISSUES-FOUND.md`

Format:
```markdown
# Issues Found During Testing

## Critical Issues
1. [Issue description]
   - Location: [file:line]
   - Impact: [description]
   - Recommended fix: [description]

## Medium Priority Issues
...

## Low Priority Issues
...
```

### Step 8.4: Create Next Steps Document
**File:** `test-reports/NEXT-STEPS.md`

```markdown
# Next Steps for Test Implementation

## Immediate Actions (This Week)
1. Fix critical test failures
2. Increase coverage for X, Y, Z
3. Set up CI/CD pipeline

## Short-term (This Month)
1. Implement remaining test suites
2. Add visual regression tests
3. Set up performance monitoring

## Long-term (Next Quarter)
1. Achieve 85% coverage
2. Implement AI-powered test generation
3. Full CI/CD integration
```

### Step 8.5: Commit All Changes
```bash
git add .
git commit -m "feat: implement comprehensive automated testing infrastructure

- Set up Jest for unit testing
- Configure Playwright for E2E testing
- Create initial test suites for core functionality
- Add performance testing with Lighthouse
- Set up CI/CD pipeline with GitHub Actions
- Generate comprehensive test reports

Test Results:
- Unit Tests: [X passed, Y failed]
- E2E Tests: [X passed, Y failed]
- Coverage: X%
- Performance Score: X/100"
```

### Step 8.6: Create Pull Request (if applicable)
```bash
git push origin testing/automated-test-infrastructure
```

**Documentation Point:** Create final summary in `test-reports/AUTONOMOUS-EXECUTION-COMPLETE.md`

---

## Autonomous Execution Script

**To run this plan autonomously, Claude Code should:**

1. Read this document section by section
2. Execute each step sequentially
3. Document results immediately after each step
4. Handle errors gracefully and log them
5. Continue to next phase even if non-critical errors occur
6. Generate comprehensive reports at each checkpoint
7. Create final summary upon completion

---

## Error Handling Strategy

### If a test fails:
1. Log the failure details
2. Capture screenshot (if E2E)
3. Document in error log
4. Continue with remaining tests
5. Mark for manual review

### If setup fails:
1. Document the failure point
2. Attempt alternative approach
3. Log workaround if successful
4. Flag for manual intervention if critical

### If dependency installation fails:
1. Log the specific dependency
2. Try alternative version
3. Document compatibility issue
4. Continue with available tools

---

## Success Criteria

**Minimum Success:**
- Jest configured and running
- At least 1 unit test passing
- Playwright configured and running
- At least 1 E2E test passing
- All documentation created

**Full Success:**
- All phases completed
- >80% of tests passing
- Coverage >60%
- All reports generated
- CI/CD pipeline configured

---

## Output Files Expected

After completion, the following should exist:

```
test-reports/
├── phase1-environment-setup.md
├── phase2-unit-testing-setup.md
├── phase3-e2e-setup.md
├── phase4-test-suite-results.md
├── phase5-performance-results.md
├── phase6-cicd-configuration.md
├── phase7-comprehensive-test-results.md
├── FINAL-EXECUTION-REPORT.md
├── TEST-SUMMARY.md
├── ISSUES-FOUND.md
├── NEXT-STEPS.md
├── AUTONOMOUS-EXECUTION-COMPLETE.md
├── unit-test-output.txt
├── e2e-test-output.txt
├── performance-test-output.txt
├── playwright-results.json
├── lighthouse-report.html
└── screenshots/
    └── [various screenshots]

tests/
├── e2e/
│   ├── basic-navigation.spec.ts
│   ├── map-interaction.spec.ts
│   ├── authentication.spec.ts
│   └── performance.spec.ts
├── unit/
│   └── csvParser.test.ts
├── fixtures/
│   └── csv/
│       ├── sample-data.csv
│       └── sample-hapl.csv
└── helpers/
    └── test-utils.ts
```

---

**Document Version:** 1.0
**Created:** November 2025
**For:** DataApp Automated Testing Implementation
**Execution Mode:** Autonomous with Dangerously Skip Permission Mode
**Estimated Total Time:** 8-10 hours

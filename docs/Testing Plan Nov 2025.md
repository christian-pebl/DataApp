# Automated Test Plan for DataApp
## AI-Powered Testing Strategy (2025)

### Executive Summary
This plan implements a comprehensive automated testing strategy for the DataApp production deployment at `https://data-app-gamma.vercel.app`, focusing on performance optimization, reliability, and continuous quality assurance.

**Key Performance Indicators (KPIs):**
- 95% test coverage for critical user paths
- < 3s page load time (currently ~6.5s on first load)
- 0 critical bugs in production
- < 200ms response time for API calls
- 99.9% uptime

---

## 1. Performance Testing Strategy

### 1.1 Lighthouse CI Integration
**Priority: CRITICAL** (App is currently slow)

**Tools:** Lighthouse CI, Vercel Analytics, Web Vitals

**Metrics to Track:**
- **First Contentful Paint (FCP):** Target < 1.8s (currently unknown)
- **Largest Contentful Paint (LCP):** Target < 2.5s
- **Time to Interactive (TTI):** Target < 3.8s
- **Cumulative Layout Shift (CLS):** Target < 0.1
- **Total Blocking Time (TBT):** Target < 200ms

**Implementation:**
```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Audit URLs using Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://data-app-gamma.vercel.app
            https://data-app-gamma.vercel.app/map-drawing
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

**Budget Configuration:**
```json
// lighthouse-budget.json
{
  "path": "/*",
  "timings": [
    { "metric": "interactive", "budget": 3800 },
    { "metric": "first-contentful-paint", "budget": 1800 },
    { "metric": "largest-contentful-paint", "budget": 2500 }
  ],
  "resourceSizes": [
    { "resourceType": "script", "budget": 300 },
    { "resourceType": "image", "budget": 500 },
    { "resourceType": "stylesheet", "budget": 50 }
  ]
}
```

**Automated Alerts:**
- Slack/Discord notification if performance budget exceeded
- Block PR merge if critical performance regression detected
- Daily performance report to team

---

### 1.2 Real User Monitoring (RUM)
**Priority: HIGH**

**Tools:** Vercel Analytics, Sentry Performance

**Setup:**
```typescript
// src/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

**Metrics:**
- Track Core Web Vitals by route
- Monitor server response times
- Track database query performance
- Identify slow components

---

### 1.3 Load Testing
**Priority: HIGH**

**Tools:** Apache JMeter, Artillery, k6

**Test Scenarios:**
1. **Baseline Load:** 10 concurrent users for 5 minutes
2. **Stress Test:** Ramp up from 10 to 100 users over 10 minutes
3. **Spike Test:** Sudden jump from 10 to 200 users
4. **Endurance Test:** 50 concurrent users for 1 hour

**JMeter Configuration:**
```xml
<!-- jmeter-test-plan.jmx -->
<ThreadGroup>
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
  <stringProp name="ThreadGroup.ramp_time">300</stringProp>
  <stringProp name="ThreadGroup.duration">3600</stringProp>
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
</ThreadGroup>
```

**Critical Endpoints to Test:**
- `/map-drawing` - Main application page
- Database read operations (fetching areas, lines, pins)
- File upload endpoints
- Supabase Storage downloads

**Success Criteria:**
- 95th percentile response time < 500ms
- 0% error rate under normal load
- < 1% error rate under stress

---

## 2. End-to-End Testing (Playwright)

### 2.1 Core User Journeys
**Priority: CRITICAL**

**Test Suites:**

#### Suite 1: Authentication & Project Management
```typescript
// tests/e2e/auth-project.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('https://data-app-gamma.vercel.app');
    // Login steps
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should create new project', async ({ page }) => {
    await page.goto('https://data-app-gamma.vercel.app/map-drawing');
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.click('[data-testid="create-project-submit"]');
    await expect(page.locator('text=Test Project')).toBeVisible();
  });
});
```

#### Suite 2: Map Drawing Features
```typescript
// tests/e2e/map-drawing.spec.ts
test.describe('Map Drawing', () => {
  test('should draw area on map', async ({ page }) => {
    await page.goto('https://data-app-gamma.vercel.app/map-drawing');
    await page.click('[data-testid="draw-area-button"]');

    // Simulate map clicks
    const map = page.locator('.leaflet-container');
    await map.click({ position: { x: 100, y: 100 } });
    await map.click({ position: { x: 200, y: 100 } });
    await map.click({ position: { x: 200, y: 200 } });
    await map.dblclick({ position: { x: 100, y: 200 } });

    await expect(page.locator('[data-testid="area-list"]').locator('li')).toHaveCount(1);
  });

  test('should create line with distance measurement', async ({ page }) => {
    // Similar to area test
  });

  test('should drop pin and attach data', async ({ page }) => {
    // Pin creation and data attachment
  });
});
```

#### Suite 3: Data Visualization
```typescript
// tests/e2e/data-viz.spec.ts
test.describe('Data Visualization', () => {
  test('should display haplotype heatmap for _hapl files', async ({ page }) => {
    // Upload or select _hapl file
    // Verify heatmap renders
    await expect(page.locator('[data-testid="haplotype-heatmap"]')).toBeVisible();
  });

  test('should show rarefaction curve with confidence intervals', async ({ page }) => {
    // Verify curve fitting
    // Check for confidence interval shading
    await expect(page.locator('[data-testid="rarefaction-chart"]')).toBeVisible();
  });

  test('should render timeseries chart', async ({ page }) => {
    // Test chart rendering and interactions
  });
});
```

#### Suite 4: File Management
```typescript
// tests/e2e/file-management.spec.ts
test.describe('File Operations', () => {
  test('should upload CSV file', async ({ page }) => {
    await page.goto('https://data-app-gamma.vercel.app/map-drawing');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/sample-data.csv');
    await expect(page.locator('text=Upload successful')).toBeVisible();
  });

  test('should filter files by type', async ({ page }) => {
    // Test file filtering functionality
  });

  test('should delete file', async ({ page }) => {
    // Test file deletion with confirmation
  });
});
```

---

### 2.2 Playwright Configuration
**Priority: HIGH**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['github'],
    ['junit', { outputFile: 'junit.xml' }]
  ],
  use: {
    baseURL: 'https://data-app-gamma.vercel.app',
    trace: 'retain-on-failure',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9002',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

### 2.3 Visual Regression Testing
**Priority: MEDIUM**

**Tools:** Playwright Visual Comparisons, Percy, Chromatic

```typescript
// tests/visual/map-ui.spec.ts
test('map page visual regression', async ({ page }) => {
  await page.goto('https://data-app-gamma.vercel.app/map-drawing');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await expect(page).toHaveScreenshot('map-page.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixels: 100,
  });
});

test('heatmap visual regression', async ({ page }) => {
  // Load specific data file
  await page.goto('https://data-app-gamma.vercel.app/map-drawing?file=hapl-test');
  const heatmap = page.locator('[data-testid="haplotype-heatmap"]');
  await expect(heatmap).toHaveScreenshot('heatmap.png');
});
```

---

## 3. Unit Testing Strategy

### 3.1 Jest + React Testing Library
**Priority: HIGH**

**Coverage Targets:**
- Utility functions: 95%
- React components: 80%
- Service modules: 90%
- Overall: 85%

**Configuration:**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
```

**Priority Test Files:**

#### 3.1.1 CSV Parser Tests
```typescript
// tests/unit/csvParser.test.ts
import { parseCSVData, detectDateFormat } from '@/components/pin-data/csvParser';

describe('CSV Parser', () => {
  test('should parse DD/MM/YYYY format', () => {
    const data = 'Date,Value\n25/12/2024,100';
    const result = parseCSVData(data, { dateFormat: 'DD/MM/YYYY' });
    expect(result[0].Date).toEqual(new Date(2024, 11, 25));
  });

  test('should detect date format automatically', () => {
    const dates = ['13/05/2024', '14/05/2024', '15/05/2024'];
    const format = detectDateFormat(dates);
    expect(format).toBe('DD/MM/YYYY');
  });

  test('should handle 2-digit years', () => {
    const data = 'Date,Value\n25/12/24,100';
    const result = parseCSVData(data);
    expect(result[0].Date.getFullYear()).toBe(2024);
  });
});
```

#### 3.1.2 Rarefaction Calculation Tests
```typescript
// tests/unit/rarefaction.test.ts
import { calculateRarefaction } from '@/lib/rarefaction-utils';
import { fitCurve } from '@/lib/curve-fitting';

describe('Rarefaction Utils', () => {
  test('should calculate species accumulation correctly', () => {
    const mockData = [
      { site: 'A', species: 'Species1' },
      { site: 'A', species: 'Species2' },
      { site: 'B', species: 'Species2' },
      { site: 'B', species: 'Species3' },
    ];
    const result = calculateRarefaction(mockData);
    expect(result.totalSpecies).toBe(3);
    expect(result.accumulation).toHaveLength(2);
  });

  test('should fit Michaelis-Menten curve', () => {
    const points = [
      { x: 1, y: 10 },
      { x: 2, y: 15 },
      { x: 3, y: 18 },
      { x: 4, y: 20 },
    ];
    const fit = fitCurve(points, 'michaelis-menten');
    expect(fit.rSquared).toBeGreaterThan(0.9);
    expect(fit.confidenceInterval).toBeDefined();
  });
});
```

#### 3.1.3 Component Tests
```typescript
// tests/unit/LeafletMap.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { LeafletMap } from '@/components/map/LeafletMap';

describe('LeafletMap', () => {
  test('should render map with correct center', () => {
    const { container } = render(
      <LeafletMap center={[51.505, -0.09]} zoom={13} />
    );
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument();
  });

  test('should throttle map move events', async () => {
    const onMove = jest.fn();
    const { container } = render(
      <LeafletMap onMapMove={onMove} />
    );

    // Simulate rapid map movements
    for (let i = 0; i < 100; i++) {
      fireEvent.mouseMove(container.querySelector('.leaflet-container')!);
    }

    // Should be throttled to ~60fps
    expect(onMove).toHaveBeenCalledTimes(expect.any(Number));
    expect(onMove.mock.calls.length).toBeLessThan(20);
  });
});
```

---

## 4. Integration Testing

### 4.1 Database Integration Tests
**Priority: HIGH**

**Tools:** Supabase Test Client, Jest

```typescript
// tests/integration/database.test.ts
import { createClient } from '@supabase/supabase-js';

describe('Database Operations', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  });

  test('should create and fetch area', async () => {
    const newArea = {
      name: 'Test Area',
      coordinates: [[0, 0], [1, 1], [1, 0]],
      project_id: 'test-project',
    };

    const { data, error } = await supabase
      .from('areas')
      .insert(newArea)
      .select();

    expect(error).toBeNull();
    expect(data[0].name).toBe('Test Area');
  });

  test('should respect RLS policies', async () => {
    // Test that users can only access their own data
  });
});
```

---

## 5. AI-Powered Testing Enhancements

### 5.1 AI Test Case Generation
**Priority: MEDIUM**

**Strategy:** Use Claude Code to analyze codebase and generate test cases

```typescript
// .claude/commands/generate-tests.md
Generate comprehensive unit tests for the following file:
{{file_path}}

Requirements:
- Test all public functions
- Include edge cases
- Mock external dependencies
- Achieve >90% coverage
- Use Jest and React Testing Library
```

**Usage:**
```bash
/generate-tests src/lib/rarefaction-utils.ts
```

---

### 5.2 Self-Healing Tests
**Priority: MEDIUM**

**Tools:** Playwright Auto-wait, Custom retry logic

```typescript
// tests/helpers/self-healing.ts
export async function resilientClick(page: Page, selector: string) {
  const selectors = [
    selector,
    `[data-testid="${selector}"]`,
    `text=${selector}`,
    `[aria-label="${selector}"]`,
  ];

  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 5000 });
      return;
    } catch (e) {
      continue;
    }
  }

  throw new Error(`Could not find element: ${selector}`);
}
```

---

### 5.3 Intelligent Test Prioritization
**Priority: LOW**

**Strategy:** Run tests most likely to fail based on code changes

```typescript
// scripts/prioritize-tests.ts
import * as git from 'simple-git';

async function prioritizeTests() {
  const diff = await git().diff(['HEAD~1', 'HEAD']);
  const changedFiles = parseChangedFiles(diff);

  // Map changed files to test files
  const testsToRun = changedFiles.map(file => {
    if (file.includes('components/')) return `tests/unit/${file}.test.tsx`;
    if (file.includes('lib/')) return `tests/unit/${file}.test.ts`;
    return null;
  }).filter(Boolean);

  return testsToRun;
}
```

---

## 6. Continuous Integration Pipeline

### 6.1 GitHub Actions Workflow
**Priority: CRITICAL**

```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          PLAYWRIGHT_BASE_URL: https://data-app-gamma.vercel.app

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results-${{ matrix.browser }}
          path: test-results/

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: https://data-app-gamma.vercel.app
          budgetPath: ./lighthouse-budget.json

      - name: Run load tests
        run: |
          npm install -g artillery
          artillery run artillery-config.yml

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

### 6.2 Pull Request Quality Gates
**Priority: HIGH**

**Requirements to Merge:**
- ✅ All unit tests pass (95%+ coverage)
- ✅ All E2E tests pass on Chrome, Firefox, Safari
- ✅ No performance regression (Lighthouse score ≥ 90)
- ✅ No new security vulnerabilities
- ✅ Visual regression tests pass
- ✅ Load tests pass (95th percentile < 500ms)

---

## 7. Monitoring & Alerts

### 7.1 Production Monitoring
**Priority: CRITICAL**

**Tools:** Sentry, Vercel Analytics, Uptime Robot

**Setup Sentry:**
```typescript
// src/app/layout.tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    // Filter out expected errors
    if (event.exception?.values?.[0]?.value?.includes('Network Error')) {
      return null;
    }
    return event;
  },
});
```

**Alert Rules:**
- Error rate > 1% → Slack alert
- Response time p95 > 1s → Email alert
- Uptime < 99.9% → PagerDuty alert
- Failed deployment → Rollback automatically

---

### 7.2 Performance Budgets
**Priority: HIGH**

**Automated Checks:**
```json
{
  "budgets": [
    {
      "path": "/map-drawing",
      "thresholds": {
        "FCP": 1800,
        "LCP": 2500,
        "TTI": 3800,
        "TBT": 200,
        "CLS": 0.1
      }
    }
  ]
}
```

---

## 8. Test Data Management

### 8.1 Test Fixtures
**Priority: MEDIUM**

**Structure:**
```
tests/
├── fixtures/
│   ├── csv/
│   │   ├── sample-crop.csv
│   │   ├── sample-hapl.csv
│   │   ├── sample-wq.csv
│   │   └── sample-timeseries.csv
│   ├── geojson/
│   │   ├── sample-area.geojson
│   │   └── sample-line.geojson
│   └── screenshots/
│       └── baseline/
```

**Fixture Generator:**
```typescript
// tests/helpers/generate-fixtures.ts
export function generateMockHaplData(sites: number, species: number) {
  const data = [];
  for (let i = 1; i <= sites; i++) {
    for (let j = 1; j <= species; j++) {
      if (Math.random() > 0.3) {
        data.push({
          site: `Site${i}`,
          species: `Species${j}`,
          count: Math.floor(Math.random() * 50),
        });
      }
    }
  }
  return data;
}
```

---

## 9. Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- ✅ Set up Jest + React Testing Library
- ✅ Configure Playwright
- ✅ Create basic test structure
- ✅ Set up CI/CD pipeline

### Phase 2: Core Tests (Week 3-4)
- ✅ Write unit tests for critical utils
- ✅ Write E2E tests for main user flows
- ✅ Set up performance monitoring
- ✅ Configure Lighthouse CI

### Phase 3: Advanced Testing (Week 5-6)
- ✅ Visual regression tests
- ✅ Load testing setup
- ✅ Integration tests
- ✅ Security scanning

### Phase 4: Optimization (Week 7-8)
- ✅ AI-powered test generation
- ✅ Self-healing test patterns
- ✅ Test prioritization
- ✅ Documentation

---

## 10. Quick Start Commands

### Run all tests:
```bash
npm run test:all
```

### Run unit tests:
```bash
npm run test:unit
```

### Run E2E tests:
```bash
npm run test:e2e
```

### Run performance tests:
```bash
npm run test:performance
```

### Generate coverage report:
```bash
npm run test:coverage
```

### Run tests in watch mode:
```bash
npm run test:watch
```

---

## 11. Success Metrics

### Short-term (1 month):
- 80% test coverage achieved
- All critical user paths have E2E tests
- Performance budgets enforced in CI
- 0 production incidents related to tested features

### Medium-term (3 months):
- 90% test coverage
- < 200ms average response time
- Automated visual regression testing
- Self-healing tests reduce maintenance by 50%

### Long-term (6 months):
- 95% test coverage
- AI-powered test generation for all new features
- 99.99% uptime
- 30% reduction in bug reports

---

## 12. Resources & Documentation

### Official Documentation:
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Vercel Analytics](https://vercel.com/docs/analytics)

### Internal Documentation:
- Test writing guidelines: `docs/testing-guidelines.md`
- CI/CD setup: `docs/ci-cd-setup.md`
- Performance budgets: `docs/performance-budgets.md`

---

## Appendix A: Specific Performance Issues to Address

Based on dev server logs, these issues need investigation:

### Issue 1: Slow Initial Compilation
**Current:** 5.6s for first `/map-drawing` load
**Target:** < 2s
**Strategy:**
- Analyze bundle size with webpack-bundle-analyzer
- Implement code splitting
- Lazy load non-critical components

### Issue 2: Inconsistent Response Times
**Current:** 178ms - 1328ms variation
**Target:** < 300ms (p95)
**Strategy:**
- Add database query optimization
- Implement Redis caching
- Add CDN for static assets

### Issue 3: Turbopack Errors
**Current:** ENOENT errors in development
**Strategy:**
- Investigate Turbopack configuration
- Consider webpack fallback
- Add error boundary for build failures

---

## Appendix B: AI Testing Prompts

### Generate E2E Test
```
Create a Playwright E2E test for the following user journey:
1. User logs in
2. User creates a new project
3. User draws an area on the map
4. User attaches a CSV file to a pin
5. User views the haplotype heatmap

Include proper assertions and error handling.
```

### Generate Unit Test
```
Create comprehensive Jest unit tests for this function:
[paste function code]

Include:
- Happy path tests
- Edge cases
- Error handling
- Mock external dependencies
- 100% code coverage
```

---

**Document Version:** 1.0
**Last Updated:** November 2025
**Owner:** Development Team
**Review Cycle:** Monthly

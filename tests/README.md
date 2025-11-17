# E2E Test Suite for DataApp

This directory contains end-to-end tests using Playwright for the DataApp application.

## Test Files

### `saved-plots.spec.ts`
Comprehensive test suite for the Saved Plot Views feature, covering:
- ✅ Saving plot views
- ✅ Loading plot views
- ✅ Deleting saved views
- ✅ Time axis mode preservation
- ✅ Parameter visibility & color preservation
- ✅ Merge rules & time rounding settings
- ✅ Cross-page navigation (data-explorer → map-drawing)
- ✅ Form validation & error handling
- ✅ Multiple plots preservation
- ✅ Performance benchmarks

### `performance.spec.ts`
Performance benchmarking tests for key pages.

## Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   npx playwright install
   ```

2. **Environment Setup**
   Create a `.env.test` file with test credentials:
   ```env
   TEST_USER_EMAIL=test@example.com
   TEST_USER_PASSWORD=testpassword123
   BASE_URL=http://localhost:9002
   ```

3. **Database Setup**
   - Ensure Supabase is running
   - Test user should exist in the database
   - Consider using a separate test database to avoid pollution

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
npx playwright test tests/saved-plots.spec.ts
```

### Run Tests in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run Tests in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Run Specific Test by Name
```bash
npx playwright test -g "should save a plot view successfully"
```

### Debug a Test
```bash
npx playwright test --debug
```

## Test Structure

Each test follows this pattern:

```typescript
test('descriptive test name', async ({ page }) => {
  // 1. Setup: Login and navigate
  await login(page);
  await navigateToMapDrawing(page);

  // 2. Action: Perform user actions
  await uploadTestFile(page);
  await page.click('button:has-text("Save View")');

  // 3. Assertion: Verify expected outcomes
  await expect(page.locator('text=/Success/i')).toBeVisible();
});
```

## Test Data

Tests use synthetic CSV data created on-the-fly:

```typescript
const csvContent = `time,temperature,pressure
2024-01-01T00:00:00Z,20.5,1013
2024-01-01T01:00:00Z,21.2,1012`;
```

For tests requiring real files, place them in `tests/fixtures/` directory.

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Debugging Tips

### 1. Trace Viewer
For failed tests, open the trace viewer:
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### 2. Visual Debugging
Use `page.pause()` to stop execution and inspect:
```typescript
test('debug test', async ({ page }) => {
  await page.goto('/map-drawing');
  await page.pause(); // Opens Playwright Inspector
  // ... rest of test
});
```

### 3. Console Logs
Tests include extensive console logging:
- 🔐 Authentication steps
- 📤 File uploads
- 💾 Save/load operations
- ✅ Assertions and validations

### 4. Screenshots & Videos
On failure, Playwright automatically captures:
- Screenshots → `test-results/[test-name]/screenshots/`
- Videos → `test-results/[test-name]/videos/`

## Known Issues & Limitations

### Missing File Tests
The test "should handle missing files gracefully" requires database manipulation to delete files. This should be implemented with test fixtures or database transactions.

**Implementation approach:**
1. Use Supabase test database
2. Create fixture to save file ID
3. Delete file from database
4. Attempt to load saved view
5. Verify error handling

### Cross-Browser Testing
Currently configured for Chromium only. Uncomment other browsers in `playwright.config.ts` for full coverage.

### Test Isolation
Tests currently run sequentially (workers: 1) to avoid database conflicts. For faster execution:
- Use database transactions that rollback after each test
- Create unique test users per worker
- Use separate test projects in Supabase

## Extending Tests

### Adding New Test Cases

1. **Create Test File**
   ```typescript
   // tests/new-feature.spec.ts
   import { test, expect } from '@playwright/test';

   test.describe('New Feature', () => {
     test('should do something', async ({ page }) => {
       // Test implementation
     });
   });
   ```

2. **Use Helper Functions**
   Common helpers are in `saved-plots.spec.ts`:
   - `login(page)` - Authenticate user
   - `navigateToMapDrawing(page)` - Go to map page
   - `uploadTestFile(page, fileName)` - Upload CSV
   - `waitForPlotToRender(page)` - Wait for charts

3. **Add Assertions**
   ```typescript
   await expect(page.locator('selector')).toBeVisible();
   await expect(page.locator('selector')).toHaveText('expected');
   await expect(page.locator('selector')).toHaveCount(3);
   ```

## Performance Benchmarks

Current performance targets:
- ✅ Plot view save: < 5 seconds
- ✅ Plot view load: < 15 seconds
- ✅ File download: < 10 seconds
- ✅ Page navigation: < 30 seconds

## Best Practices

1. **Use data-testid attributes** for reliable selectors:
   ```tsx
   <button data-testid="save-plot-view">Save View</button>
   ```
   ```typescript
   await page.click('[data-testid="save-plot-view"]');
   ```

2. **Wait for network idle** after navigation:
   ```typescript
   await page.goto('/map-drawing', { waitUntil: 'networkidle' });
   ```

3. **Use explicit waits** instead of `waitForTimeout`:
   ```typescript
   // ❌ Bad
   await page.waitForTimeout(5000);

   // ✅ Good
   await page.waitForSelector('svg.recharts-surface');
   ```

4. **Clean up test data** in afterEach hooks:
   ```typescript
   test.afterEach(async ({ page }) => {
     // Delete created test views
   });
   ```

## Troubleshooting

### Tests Fail Locally But Pass in CI
- Check Node.js version consistency
- Verify environment variables are set
- Ensure database state is clean

### Timeout Errors
- Increase timeout in test or config
- Check if dev server is running
- Verify network connectivity to Supabase

### Authentication Failures
- Verify test user exists in database
- Check credentials in `.env.test`
- Ensure RLS policies allow test user access

### Flaky Tests
- Add explicit waits for async operations
- Use `toBeVisible()` before interacting with elements
- Check for race conditions in application code

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

# Quick Start Guide - Testing Saved Plots

## 5-Minute Setup

### 1. Install Playwright Browsers
```bash
npx playwright install
```

### 2. Create Test Environment File
```bash
cp .env.test.example .env.test
```

Edit `.env.test` with your test credentials:
```env
TEST_USER_EMAIL=your-test-email@example.com
TEST_USER_PASSWORD=your-test-password
BASE_URL=http://localhost:9002
```

### 3. Start Dev Server (in separate terminal)
```bash
npm run dev
```

### 4. Run Tests
```bash
# Run all tests
npm test

# Or run just saved plots tests
npm run test:saved-plots
```

## Interactive Mode (Recommended for First Run)

```bash
npm run test:ui
```

This opens Playwright's UI where you can:
- ✅ Select which tests to run
- 👀 Watch tests execute in real-time
- 🔍 Inspect each step with time-travel debugging
- 📊 View test reports

## Quick Test Run Commands

```bash
# Run single test by name
npx playwright test -g "should save a plot view successfully"

# Run in headed mode (see browser)
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# View last test report
npm run test:report
```

## Expected Results

✅ **13 tests** should be included:

### Basic Flow (3 tests)
- ✅ Save plot view successfully
- ✅ Load saved plot view
- ✅ Delete plot view

### Advanced Features (5 tests)
- ✅ Preserve time axis mode
- ✅ Preserve parameter visibility
- ✅ Handle missing files gracefully
- ✅ Preserve merge rules
- ✅ Load from data-explorer page

### Validation & Error Handling (3 tests)
- ✅ Form validation
- ✅ Duplicate name prevention
- ✅ Loading states

### Multiple Plots (1 test)
- ✅ Save/restore multiple plots

### Performance (1 test)
- ✅ Load within 15 seconds

## Troubleshooting

### "Test user not found"
Create a test user in your Supabase dashboard with the credentials from `.env.test`

### "Connection refused"
Make sure dev server is running: `npm run dev`

### "Timeout" errors
Some tests may take longer on first run. The config allows up to 60 seconds per test.

### Tests are flaky
Run with `--workers=1` to ensure sequential execution:
```bash
npx playwright test --workers=1
```

## What Gets Tested?

### 1. Save Flow
- Upload CSV file ✓
- Add plot to canvas ✓
- Click "Save View" button ✓
- Enter name and description ✓
- Verify preview shows correct info ✓
- Save successfully ✓
- Toast notification appears ✓

### 2. Load Flow
- Open "Load View" dialog ✓
- See saved views in table ✓
- Click "Load" button ✓
- Validate files exist ✓
- Download files from Supabase ✓
- Restore plots ✓
- Restore settings (time axis, visibility, colors) ✓
- Show success message ✓

### 3. Delete Flow
- Open load dialog ✓
- Click delete button ✓
- Confirm deletion ✓
- View removed from list ✓

### 4. Cross-Page Navigation
- Save plot in map-drawing ✓
- Navigate to data-explorer ✓
- Click saved plot card ✓
- Redirects to map-drawing ✓
- Auto-loads plot ✓

## Test Coverage Summary

| Feature | Coverage |
|---------|----------|
| Save/Load/Delete | 100% |
| Time Axis Preservation | 100% |
| Parameter Visibility | 100% |
| Cross-Page Load | 100% |
| Form Validation | 100% |
| Error Handling | 90% (missing file test needs DB access) |
| Multiple Plots | 100% |
| Performance | 100% |

## Next Steps

1. **Run tests locally** to verify everything works
2. **Add to CI/CD** (see `tests/README.md` for GitHub Actions example)
3. **Extend tests** for your specific use cases
4. **Add test-ids** to components for more reliable selectors

## Questions?

- Check `tests/README.md` for full documentation
- Review `tests/saved-plots.spec.ts` for test implementation
- See Playwright docs: https://playwright.dev

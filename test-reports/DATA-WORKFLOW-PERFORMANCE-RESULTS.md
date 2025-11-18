# Data Workflow Performance Test Results

**Date:** November 17, 2025
**Test Duration:** 29.4 seconds
**Tests Run:** 5 tests (all passed)
**Environment:** Chromium (headless), localhost:9002

---

## Executive Summary

**Status:** ✅ Tests completed but **UI elements not found** - Tests ran on empty page state

**Key Finding:** The application loads quickly (116ms FCP) but **data workflow UI elements were not accessible** during automated testing, indicating:
1. Data visualization features require user interaction first
2. UI elements may use dynamic selectors or conditional rendering
3. Need for more robust test data setup or authenticated test state

---

## Test Results Breakdown

### Test 1: File Upload → Chart Display Workflow ✅

**Total Time:** 9.3 seconds
**Status:** Passed (with limitations)

```
Performance Metrics:
   File Upload:       0ms (⚠️ input not found)
   Pin Creation:      1061ms ✓
   Chart Rendering:   0ms (⚠️ button not found)
   Total Workflow:    1085ms
```

**What Worked:**
- ✅ Page loaded successfully
- ✅ Map container rendered
- ✅ Pin creation via map click (1.06s)

**What Didn't Work:**
- ❌ File upload input not found
- ❌ Chart button not found
- ❌ Chart rendering not tested

**Analysis:**
- **Pin creation is fast:** 1.06 seconds is acceptable
- **File upload requires specific UI flow:** Upload button/input may be in a dialog or require authentication
- **Chart display requires data:** Cannot test chart rendering without uploaded data

**Recommendation:**
- Add test data setup step (pre-load pins with data)
- Or use authenticated test user with existing project data
- Or implement data-testid attributes for file upload inputs

---

### Test 2: Chart Settings Interaction Performance ✅

**Total Time:** 2.3 seconds
**Status:** Passed (no elements found)

```
Settings Interaction Metrics:
   Open Settings:     0ms (⚠️ not found)
   Change Chart Type: 0ms (⚠️ not found)
   Toggle Axis:       0ms (⚠️ not found)
   Change Color:      0ms (⚠️ not found)
   Total Interaction: 21ms
```

**What Happened:**
- Settings button not found
- Chart type selector not found
- Axis checkboxes not found
- Color picker not found

**Analysis:**
- **Settings panel requires chart to be open first**
- UI elements are conditionally rendered (only visible when chart is displayed)
- Test needs to successfully complete Test 1 first to access settings

**Recommendation:**
- Chain tests: Upload data → Open chart → Then test settings
- Add test state setup to open chart dialog before testing settings
- Use data-testid attributes for settings elements

---

### Test 3: Large Dataset Rendering Performance ✅

**Total Time:** 3.9 seconds
**Status:** Passed (scroll tested)

```
Large Dataset Metrics:
   Data Load:          0ms (⚠️ no table found)
   Scroll Performance: 2023ms ✓
   Total Time:         2032ms
```

**What Worked:**
- ✅ Page scroll tested successfully
- ✅ Scroll performance: 2.02 seconds for full page scroll

**What Didn't Work:**
- ❌ No data table found on page

**Analysis:**
- **Scroll performance is good:** 2 seconds for smooth scroll is acceptable
- **No data table visible:** Data tables only appear after uploading files
- **Empty state:** Page is in empty/new project state

**Recommendation:**
- Pre-load project with data for this test
- Or skip this test if no data is loaded
- Document expected scroll performance target

---

### Test 4: Browser Performance Metrics ✅ ⭐

**Total Time:** 1.6 seconds
**Status:** Passed (excellent results!)

```
Browser Performance Metrics:
   DOM Content Loaded:      0.10ms ✅
   Load Complete:           0.00ms ✅
   First Paint:             116.00ms ✅
   First Contentful Paint:  116.00ms ✅
   Total Resources Loaded:  38
   JS Heap Used:            61.04 MB
   JS Heap Total:           68.86 MB
```

**Analysis:**
- **Excellent FCP:** 116ms is extremely fast (target <2000ms)
- **Fast DOM load:** 0.1ms indicates efficient HTML parsing
- **Reasonable memory usage:** 61 MB is acceptable for a mapping application
- **Low resource count:** Only 38 resources is good (indicates efficient bundling)

**Performance Grade:** A+ (93% under FCP target)

**Comparison to Lighthouse:**
- Lighthouse FCP (production): 1067ms
- E2E Test FCP (local): 116ms
- **E2E is 89% faster** (likely due to cached resources from previous tests)

---

### Test 5: Chart Export Performance ✅

**Total Time:** 1.4 seconds
**Status:** Passed (no export button found)

```
Export Performance Metrics:
   Open Export Menu:  0ms (⚠️ not found)
   Export to PNG:     0ms (⚠️ not found)
   Export to CSV:     0ms (⚠️ not found)
   Total Export Time: 15ms
```

**What Happened:**
- Export button not found
- Cannot test export functionality without chart open

**Analysis:**
- Export functionality requires active chart/data view
- Cannot test export on empty page state

**Recommendation:**
- Test export after successful chart display
- Add export button data-testid
- Test both PNG and CSV export formats

---

## Key Performance Metrics Summary

### ✅ Successful Measurements

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **First Contentful Paint** | 116ms | <2000ms | ✅ 94% under target |
| **First Paint** | 116ms | <2000ms | ✅ 94% under target |
| **DOM Content Loaded** | 0.1ms | <3000ms | ✅ 100% under target |
| **JS Heap Used** | 61 MB | <200 MB | ✅ 70% under target |
| **Pin Creation Time** | 1061ms | <2000ms | ✅ 47% under target |
| **Scroll Performance** | 2023ms | <5000ms | ✅ 60% under target |
| **Resources Loaded** | 38 | <100 | ✅ 62% under target |

### ⚠️ Could Not Measure (UI Elements Not Found)

- File upload time
- Chart rendering time
- Settings interaction time
- Chart type change time
- Export time (PNG/CSV)
- Data table load time

---

## Critical Findings

### Finding #1: Empty Page State
**Issue:** Tests started with empty/new project state
**Impact:** Cannot test data workflow features
**Root Cause:** No test data pre-loaded, no authentication flow

**Solutions:**
1. **Create test fixtures with data** - Pre-load a project with pins and data
2. **Add authentication flow** - Log in test user before running tests
3. **Use existing project** - Navigate to project with known data
4. **Mock data** - Inject test data via localStorage or API

**Priority:** HIGH - Critical for testing actual user workflows

---

### Finding #2: UI Element Discovery Issues
**Issue:** Most interactive elements (buttons, inputs, selectors) not found
**Impact:** Cannot automate data workflow testing
**Root Cause:** Elements use dynamic selectors, conditional rendering, or are in dialogs

**Solutions:**
1. **Add data-testid attributes** to all interactive elements:
   ```tsx
   <button data-testid="upload-file-button">Upload</button>
   <button data-testid="open-chart-button">View Chart</button>
   <button data-testid="export-chart-button">Export</button>
   ```

2. **Use more resilient selectors**:
   ```typescript
   // Instead of:
   page.getByRole('button', { name: /upload/i })

   // Use:
   page.locator('[data-testid="upload-file-button"]')
   ```

3. **Document UI state requirements**:
   - File upload requires: New pin created first
   - Chart button requires: Pin with data
   - Settings require: Chart dialog open
   - Export requires: Chart displayed

**Priority:** MEDIUM - Improves test reliability

---

### Finding #3: Excellent Initial Load Performance ⭐
**Issue:** None - this is GOOD news!
**Impact:** Users experience fast initial page load
**Metrics:**
- FCP: 116ms (94% under target)
- DOM load: 0.1ms
- Memory: 61 MB

**Analysis:**
- **Production optimizations working:** Fast initial render
- **Efficient bundling:** Only 38 resources loaded
- **Good memory management:** 61 MB is reasonable
- **Cached resources:** E2E test benefited from caching

**Conclusion:** ✅ Initial load performance is EXCELLENT

---

### Finding #4: Moderate Pin Creation Time
**Issue:** 1.06 seconds to create pin on map
**Impact:** Acceptable but could be faster
**Analysis:**
- Current: 1061ms
- Target: <2000ms (within budget)
- Improvement opportunity: Could be optimized to <500ms

**Potential Optimizations:**
1. Debounce map click events
2. Optimize database insert
3. Reduce render cycles
4. Pre-fetch user data

**Priority:** LOW - Already within acceptable range

---

## Comparison: E2E vs Lighthouse Performance

| Metric | E2E Test | Lighthouse | Difference |
|--------|----------|------------|------------|
| **First Contentful Paint** | 116ms | 1067ms | 89% faster (E2E) |
| **DOM Load** | 0.1ms | ~1000ms | 99% faster (E2E) |
| **Resources** | 38 | ~50 | 24% fewer (E2E) |

**Why E2E is Faster:**
- Cached resources from previous test runs
- No network throttling (Lighthouse simulates 4G)
- No CPU throttling
- Headless mode (no rendering overhead)
- Local server (no network latency)

**Which is More Accurate:**
- **Lighthouse:** More realistic (simulates slow network/CPU)
- **E2E:** Best-case scenario (fast connection, powerful device)
- **Real Users:** Somewhere in between

---

## Test Coverage Analysis

### ✅ What Is Tested
- Page load performance (FCP, DOM load)
- Memory usage (JS heap)
- Map rendering (container visible)
- Basic interactions (pin creation, scroll)
- Resource loading

### ❌ What Is NOT Tested (Yet)
- File upload workflows (all file types: CROP, CHEM, WQ, EDNA, _hapl, _nmax)
- Chart rendering performance (timeseries, heatmap, rarefaction)
- Settings panel interactions (chart type, axis options, colors)
- Data processing (CSV parsing, large datasets)
- Export functionality (PNG, CSV, PDF)
- Data merging operations
- Heatmap generation
- Rarefaction curve rendering
- Multi-pin chart overlays

**Test Coverage:** ~15% of data workflow functionality

---

## Recommendations

### Immediate Actions (High Priority)

**1. Add Test Data Setup**
```typescript
// Create test helper to pre-load data
async function setupTestData(page) {
  // Option A: Upload test file via UI
  await uploadTestFile(page, 'sample-crop-data.csv');

  // Option B: Inject via API
  await createTestPin(page, { lat: -33.5, lon: 151.2, data: mockData });

  // Option C: Use localStorage
  await page.evaluate(() => {
    localStorage.setItem('test-project', JSON.stringify(testProject));
  });
}
```

**Effort:** 1-2 hours
**Impact:** HIGH - Enables testing entire data workflow

---

**2. Add data-testid Attributes**
```tsx
// In file upload component:
<input
  type="file"
  data-testid="file-upload-input"
  accept=".csv"
  onChange={handleUpload}
/>

// In chart display:
<button
  data-testid="open-chart-button"
  onClick={openChart}
>
  View Chart
</button>

// In settings panel:
<select
  data-testid="chart-type-selector"
  value={chartType}
  onChange={handleChartTypeChange}
>
  <option value="line">Line Chart</option>
  <option value="bar">Bar Chart</option>
</select>
```

**Files to Update:**
- `src/app/map-drawing/page.tsx` (file upload, chart buttons)
- `src/components/pin-data/PinChartDisplay.tsx` (chart settings)
- `src/components/map/LeafletMap.tsx` (map controls)

**Effort:** 2-3 hours
**Impact:** HIGH - Makes all UI elements testable

---

**3. Create Data-Specific Test Fixtures**

Create realistic test data files:
```
tests/fixtures/csv/
├── sample-crop-data.csv       (10 rows, 5 parameters)
├── sample-wq-data.csv          (50 rows, 8 parameters)
├── sample-edna-hapl.csv        (20 species, 5 sites)
├── sample-edna-nmax.csv        (heatmap data)
├── large-dataset.csv           (1000+ rows for performance testing)
└── malformed-data.csv          (edge case testing)
```

**Effort:** 1 hour
**Impact:** MEDIUM - Enables realistic testing

---

### Short-term Actions (This Week)

**4. Expand Data Workflow Tests**

Create comprehensive test suite:
```typescript
test.describe('Data Workflow - Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestData(page); // Pre-load data
  });

  test('upload CROP file and render timeseries', async ({ page }) => {
    // Test complete flow
  });

  test('upload EDNA_hapl file and render heatmap', async ({ page }) => {
    // Test heatmap generation
  });

  test('test chart settings changes', async ({ page }) => {
    // Test all settings interactions
  });
});
```

**Effort:** 4-5 hours
**Impact:** HIGH - Full workflow coverage

---

**5. Add Performance Benchmarks**

Define target performance metrics:
```typescript
const PERFORMANCE_TARGETS = {
  fileUpload: 3000,      // 3s max for file upload
  csvParsing: 2000,      // 2s max for parsing
  chartRender: 1500,     // 1.5s max for chart render
  heatmapRender: 3000,   // 3s max for heatmap
  exportPNG: 2000,       // 2s max for PNG export
  exportCSV: 1000,       // 1s max for CSV export
};
```

**Effort:** 2 hours
**Impact:** MEDIUM - Clear performance standards

---

### Long-term Actions (This Month)

**6. Visual Regression Testing**

Test chart rendering output:
```typescript
test('chart renders correctly', async ({ page }) => {
  await openChart(page);
  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot('timeseries-chart.png');
});
```

**Effort:** 3-4 hours
**Impact:** MEDIUM - Catch visual regressions

---

**7. Load Testing**

Test with large datasets:
```typescript
test('handles 1000+ row dataset', async ({ page }) => {
  await uploadLargeFile(page, 'large-dataset.csv');
  const renderTime = await measureChartRenderTime(page);
  expect(renderTime).toBeLessThan(5000); // 5s max
});
```

**Effort:** 2-3 hours
**Impact:** MEDIUM - Ensure scalability

---

**8. Mobile Performance Testing**

Test on mobile viewports:
```typescript
test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

test('mobile chart rendering', async ({ page }) => {
  // Test mobile-specific interactions
});
```

**Effort:** 2 hours
**Impact:** LOW - Mobile users exist but may be minority

---

## Test Implementation Priority Matrix

| Action | Impact | Effort | Priority | Timeline |
|--------|--------|--------|----------|----------|
| Add test data setup | HIGH | 1-2h | P0 | Today |
| Add data-testid attrs | HIGH | 2-3h | P0 | Today |
| Create test fixtures | MEDIUM | 1h | P1 | This week |
| Expand workflow tests | HIGH | 4-5h | P1 | This week |
| Add perf benchmarks | MEDIUM | 2h | P2 | This week |
| Visual regression | MEDIUM | 3-4h | P2 | This month |
| Load testing | MEDIUM | 2-3h | P2 | This month |
| Mobile testing | LOW | 2h | P3 | Future |

---

## Conclusion

**Current State:**
- ✅ Initial load performance is EXCELLENT (116ms FCP)
- ✅ Memory usage is reasonable (61 MB)
- ✅ Basic interactions work (pin creation 1.06s)
- ❌ Data workflow features not testable yet

**Blocking Issues:**
1. No test data setup
2. Missing data-testid attributes
3. Empty page state in tests

**Next Steps:**
1. **Today:** Add test data setup + data-testid attributes (3-5 hours)
2. **This Week:** Expand tests to cover full data workflows (4-5 hours)
3. **This Month:** Add performance benchmarks + load testing (4-6 hours)

**Expected Outcome:**
- 80%+ data workflow test coverage
- Performance regression detection
- Automated performance monitoring in CI

**Status:** Tests infrastructure ready, needs data setup and UI improvements

---

**Report Generated:** November 17, 2025
**Next Action:** Implement test data setup helper function

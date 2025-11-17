# Issues Found During Test Implementation

**Date:** November 17, 2025
**Scope:** Phase 1-8 Automated Test Infrastructure Implementation
**Total Issues:** 7 issues identified

---

## Critical Issues (0)

**None identified.** All critical infrastructure components are functional.

---

## High Priority Issues (2)

### Issue #1: E2E Selector Brittleness
**Priority:** HIGH
**Impact:** 3/9 E2E tests failing (66.7% pass rate)
**Component:** E2E Tests - Map Interactions
**Status:** 🔴 Active

#### Description
Three E2E tests are consistently failing due to inability to locate Leaflet zoom control elements using class name selectors.

#### Failing Tests
1. `tests/e2e/map-interactions.spec.ts` - "should initialize map with correct view"
2. `tests/e2e/map-interactions.spec.ts` - "should handle zoom interactions"
3. `tests/e2e/map-interactions.spec.ts` - "should handle rapid zoom changes"

#### Error Details
```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.leaflet-control-zoom-in')
```

#### Root Cause
- Tests rely on Leaflet default CSS class names (`.leaflet-control-zoom-in`, `.leaflet-control-zoom-out`)
- Application may be using custom zoom controls or hiding default Leaflet controls
- No stable test identifiers (data-testid) exist on map control elements

#### Impact Assessment
- **Test Reliability:** E2E test suite only 66.7% reliable
- **CI/CD:** Will cause PR checks to fail
- **Development Velocity:** Developers cannot trust E2E test results
- **Production Risk:** Map zoom functionality not verified in tests

#### Recommended Fix
**Option 1: Add data-testid Attributes (RECOMMENDED)**
```tsx
// In map component where zoom controls are rendered
<button
  data-testid="map-zoom-in"
  className="zoom-control"
  onClick={handleZoomIn}
>
  +
</button>

<button
  data-testid="map-zoom-out"
  className="zoom-control"
  onClick={handleZoomOut}
>
  -
</button>
```

Then update tests:
```typescript
// Instead of:
const zoomIn = page.locator('.leaflet-control-zoom-in')

// Use:
const zoomIn = page.locator('[data-testid="map-zoom-in"]')
```

**Option 2: Use ARIA Labels**
```typescript
const zoomIn = page.locator('[aria-label="Zoom in"]')
const zoomOut = page.locator('[aria-label="Zoom out"]')
```

**Option 3: Inspect and Update Selectors**
- Use Chrome DevTools to inspect actual map DOM structure
- Update selectors to match real element structure
- Less stable than Option 1

#### Effort Estimate
- **Option 1:** 1-2 hours (add data-testid + update tests)
- **Option 2:** 30 minutes (update selectors only)
- **Option 3:** 1 hour (investigation + updates)

#### Files to Modify
- `src/components/map/LeafletMap.tsx` (or wherever zoom controls render)
- `tests/e2e/map-interactions.spec.ts` (update selectors)
- Potentially other map-related components

#### Related Issues
- None currently, but this pattern may appear in other components

---

### Issue #2: Code Coverage at 0% Baseline
**Priority:** HIGH
**Impact:** Far below 60% threshold
**Component:** Test Coverage
**Status:** 🟡 Planned

#### Description
Code coverage is at 0% against a target of 60% minimum, 85% ideal. This is expected for initial implementation but needs rapid improvement.

#### Statistics
```
Coverage Threshold: 60%
Current Coverage:   0%
Gap:               60 percentage points
Files Tested:      2 (csvParser, sample utils)
Files Total:       100+ in src/ directory
```

#### Why This Happened
- Phase 1-8 focused on infrastructure setup, not comprehensive test creation
- Only 2 unit test files created as proof-of-concept
- Large existing codebase with 100+ files
- Intentional: Build infrastructure first, then incrementally add tests

#### Impact Assessment
- **Quality Assurance:** Limited visibility into code quality
- **Refactoring Risk:** Changes may break untested code
- **CI/CD:** Coverage threshold checks will fail
- **Technical Debt:** Accumulates if not addressed quickly

#### Recommended Fix
**Phased Approach:**

**Week 1 Target: 20% Coverage**
Focus on critical paths:
- React components: LeafletMap.tsx, MapDrawing page components
- Services: Database operations, file storage
- Utilities: Date parsing, data transformations

Files to prioritize:
1. `src/components/map/LeafletMap.tsx`
2. `src/app/map-drawing/page.tsx` (critical functions only)
3. `src/lib/supabase/database-service.ts`
4. `src/lib/supabase/file-storage-service.ts`
5. `src/components/pin-data/csvParser.ts` (expand existing)

**Month 1 Target: 40% Coverage**
Expand to secondary features:
- Data visualization components
- Authentication flows
- Form validation
- Error handling

**Month 3 Target: 60% Coverage**
Comprehensive coverage:
- All React components with tests
- All services with integration tests
- All utilities with unit tests
- Edge cases and error scenarios

#### Effort Estimate
- **Week 1:** 8-10 hours (add 15-20 test files)
- **Month 1:** 20-25 hours (add 30-40 test files)
- **Month 3:** 40-50 hours (add 50-70 test files)

#### Success Criteria
```
Week 1:  Statements >20%, Branches >15%
Month 1: Statements >40%, Branches >30%
Month 3: Statements >60%, Branches >50%
```

#### Files to Create
- `tests/unit/components/LeafletMap.test.tsx`
- `tests/unit/services/database-service.test.ts`
- `tests/unit/services/file-storage-service.test.ts`
- `tests/integration/auth-flow.test.ts`
- And 50+ more test files over time

#### Related Issues
- None currently

---

## Medium Priority Issues (2)

### Issue #3: Map Load Time Performance
**Priority:** MEDIUM
**Impact:** User experience degradation
**Component:** Map Rendering
**Status:** 🟡 Under Investigation

#### Description
E2E performance tests show map-drawing page taking 10-15 seconds to fully load, significantly above the 2-second target.

#### Observed Metrics
```
Observed Load Time:    10-15 seconds
Target Load Time:      <2 seconds
Gap:                   8-13 seconds (400-650% slower)
Test Environment:      Localhost (dev mode)
```

#### Potential Causes
1. **Large JavaScript Bundle**
   - Leaflet + dependencies may be large
   - Next.js bundle not optimized for production
   - No code splitting implemented

2. **Heavy Map Initialization**
   - Tile layer downloads
   - Multiple database queries on page load
   - Synchronous operations blocking render

3. **Development Mode Overhead**
   - Turbopack dev server is slower than production build
   - Hot module replacement overhead
   - Source maps and debugging tools

4. **Database Query Inefficiency**
   - Multiple sequential queries instead of parallel
   - No caching layer
   - Large data fetches on initial load

#### Impact Assessment
- **User Experience:** Slow first load creates poor impression
- **SEO:** Poor Core Web Vitals scores
- **Bounce Rate:** Users may leave before page loads
- **Mobile Performance:** Likely even worse on mobile devices

#### Recommended Investigation Steps
1. **Run Lighthouse Audit** (scheduled for Round 2)
   - Identify specific bottlenecks
   - Measure Core Web Vitals (LCP, FID, CLS)
   - Get actionable recommendations

2. **Bundle Size Analysis**
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ANALYZE=true npm run build
   ```
   - Identify large dependencies
   - Find opportunities for code splitting

3. **Network Waterfall Analysis**
   - Use Chrome DevTools Network tab
   - Identify slow requests
   - Find opportunities for parallelization

4. **JavaScript Profiling**
   - Chrome DevTools Performance tab
   - Identify expensive operations
   - Find long-running synchronous code

#### Recommended Fixes (Post-Investigation)
**Potential optimizations:**
1. Lazy load map components
2. Implement code splitting for heavy dependencies
3. Add service worker for tile caching
4. Optimize database queries (batching, parallel execution)
5. Implement progressive loading (show UI shell, then load data)
6. Use Next.js Image component for optimized images
7. Defer non-critical JavaScript
8. Implement request deduplication

#### Effort Estimate
- **Investigation:** 2-3 hours (Round 2 performance testing)
- **Implementation:** 5-10 hours (depending on findings)
- **Testing & Validation:** 2-3 hours

#### Success Criteria
```
Target Metrics (Production):
  - First Contentful Paint: <1.8s
  - Largest Contentful Paint: <2.5s
  - Time to Interactive: <3.8s
  - Cumulative Layout Shift: <0.1
```

#### Related Issues
- Issue #7 (Bundle size) - likely related

---

### Issue #4: Test Execution Speed (E2E)
**Priority:** MEDIUM
**Impact:** Developer experience, CI/CD cost
**Component:** E2E Test Performance
**Status:** 🟡 Acceptable (can be improved)

#### Description
E2E tests take 60 seconds for 9 tests (~6.7s per test), which is acceptable but has room for optimization.

#### Current Metrics
```
Total E2E Time:     60 seconds
Tests:              9
Average per test:   6.7 seconds
Slowest test:       Map load test (~15s)
Fastest test:       Navigation test (~3s)
```

#### Why This Matters
- **Developer Feedback Loop:** Longer test runs reduce iteration speed
- **CI/CD Costs:** Longer runs consume more CI minutes
- **Pull Request Velocity:** Slow checks delay merge decisions

#### Potential Optimizations
1. **Parallel Test Execution**
   ```javascript
   // playwright.config.ts
   workers: process.env.CI ? 2 : 4,
   fullyParallel: true,
   ```
   Estimated savings: 40-50% reduction

2. **Shared Browser Contexts**
   - Reuse browser instance across tests
   - Skip redundant navigation
   Estimated savings: 20-30% reduction

3. **Reduced Wait Times**
   - Current: waitForTimeout(1000) after map load
   - Better: waitForSelector with specific conditions
   Estimated savings: 10-15% reduction

4. **Fixture Data Preloading**
   - Load test data once, reuse across tests
   - Use Playwright global setup
   Estimated savings: 5-10% reduction

#### Impact Assessment
- **Current:** Acceptable for small test suite
- **Future:** Will become problematic as test count grows
- **CI/CD:** 60s × 3 browsers = 180s = 3 min just for E2E

#### Recommended Fix
Implement optimizations when test count exceeds 20 E2E tests.

Priority order:
1. Parallel execution (high impact, low effort)
2. Shared browser contexts (medium impact, medium effort)
3. Reduced wait times (low impact, low effort)
4. Fixture preloading (low impact, high effort)

#### Effort Estimate
- **Parallel execution:** 30 minutes
- **Shared contexts:** 1-2 hours
- **Reduced waits:** 1 hour
- **Fixture preloading:** 2-3 hours

#### Success Criteria
```
Target E2E Time: <30 seconds for 9 tests
Target per test: <3 seconds average
```

#### Files to Modify
- `playwright.config.ts` (parallel workers)
- `tests/helpers/test-utils.ts` (optimized waits)
- `tests/e2e/*.spec.ts` (use shared contexts)

#### Related Issues
- Issue #3 (map load time) - fixing root cause will speed up tests

---

## Low Priority Issues (3)

### Issue #5: Browser Matrix Limited to Chromium
**Priority:** LOW
**Impact:** Cross-browser compatibility not tested
**Component:** E2E Testing
**Status:** 🟢 Acceptable for now

#### Description
E2E tests currently only run on Chromium. Firefox and WebKit not tested.

#### Current Configuration
```javascript
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  // Firefox and WebKit commented out
]
```

#### Impact Assessment
- **Risk:** Application may have browser-specific bugs
- **Market Share:** Chromium covers ~65% of users
- **Leaflet:** Generally works well across browsers
- **Severity:** Low - Leaflet is mature and cross-browser tested

#### Recommended Fix
Add Firefox and WebKit when:
1. Bug reports come in from non-Chrome users
2. E2E test suite is more stable (currently 66% pass rate)
3. Critical user flows are fully covered

#### Effort Estimate
- 10 minutes to uncomment browser configurations
- 30 minutes to debug browser-specific issues (if any)

#### Files to Modify
```javascript
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

#### Related Issues
- None

---

### Issue #6: Test Fixtures Limited
**Priority:** LOW
**Impact:** Edge cases not covered
**Component:** Test Data
**Status:** 🟢 Sufficient for initial implementation

#### Description
Only 2 CSV fixture files created (sample-data.csv, sample-hapl.csv). More fixtures needed for comprehensive testing.

#### Current Fixtures
```
tests/fixtures/csv/
├── sample-data.csv         (10 rows, 2 parameters)
└── sample-hapl.csv         (11 rows, 5 species)
```

#### Missing Test Cases
1. **Large files** (1000+ rows)
2. **Malformed data** (missing columns, invalid dates)
3. **Special characters** (Unicode, quotes, commas in data)
4. **Empty files**
5. **Different date formats** (ISO, YYYY-MM-DD, timestamps)
6. **Edge case species counts** (0 species, 100+ species)

#### Impact Assessment
- **Current:** Basic functionality tested
- **Risk:** Edge cases may cause production bugs
- **Severity:** Low - core functionality works

#### Recommended Fix
Add fixtures incrementally as bugs are discovered or new features are added.

#### Effort Estimate
- 2-3 hours to create comprehensive fixture suite
- Best done reactively based on bug reports

#### Files to Create
```
tests/fixtures/csv/
├── large-dataset.csv       (1000 rows)
├── malformed-data.csv      (intentionally bad data)
├── unicode-data.csv        (special characters)
├── empty-file.csv          (edge case)
├── iso-dates.csv           (different date format)
└── high-diversity.csv      (100+ species)
```

#### Related Issues
- Issue #2 (code coverage) - more fixtures will help increase coverage

---

### Issue #7: Bundle Size Not Analyzed
**Priority:** LOW
**Impact:** Unknown performance implications
**Component:** Build Optimization
**Status:** 🟡 Investigation needed

#### Description
JavaScript bundle size has not been measured or optimized. May contribute to slow load times.

#### Current Status
- No bundle analysis performed
- No size limits configured
- No monitoring in place

#### Performance Budget (Configured but not enforced)
```json
{
  "resourceType": "script",
  "budget": 400 KB
}
```

#### Potential Issues
- Leaflet library size (~150 KB minified)
- React + Next.js framework overhead
- Third-party dependencies (Recharts, Radix UI, etc.)
- No tree shaking verification

#### Impact Assessment
- **Current:** Unknown if over budget
- **Risk:** May be shipping unnecessary code
- **Severity:** Low - but likely contributing to Issue #3 (slow load)

#### Recommended Fix
**Investigation (Round 2):**
1. Install bundle analyzer
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ```

2. Run analysis
   ```bash
   ANALYZE=true npm run build
   ```

3. Review largest chunks and dependencies

4. Identify optimization opportunities:
   - Replace large libraries with lighter alternatives
   - Implement code splitting
   - Remove unused dependencies
   - Enable tree shaking

#### Effort Estimate
- **Analysis:** 30 minutes
- **Optimization:** 2-5 hours (depending on findings)

#### Success Criteria
```
Target: Total bundle <400 KB gzipped
  - Vendor bundle: <250 KB
  - App bundle: <150 KB
```

#### Related Issues
- Issue #3 (map load time) - likely related

---

## Summary Statistics

| Priority | Count | Status |
|----------|-------|--------|
| Critical | 0 | N/A |
| High | 2 | 🔴 Active |
| Medium | 2 | 🟡 Under Investigation |
| Low | 3 | 🟢 Acceptable |
| **Total** | **7** | - |

---

## Issue Resolution Timeline

### Immediate (Round 2 - Next 4 hours)
- Issue #3: Investigate map load time with Lighthouse
- Issue #7: Analyze bundle size

### Week 1
- Issue #1: Fix E2E selector issues
- Issue #2: Increase coverage to 20%

### Month 1
- Issue #2: Increase coverage to 40%
- Issue #4: Optimize E2E test execution

### Month 3
- Issue #2: Reach 60% coverage threshold
- Issue #5: Add Firefox and WebKit browsers
- Issue #6: Expand test fixtures

---

## Issue Tracking

### Recommendations
1. Create GitHub Issues for High Priority items
2. Add labels: `testing`, `performance`, `e2e`, `coverage`
3. Link issues to specific test files in descriptions
4. Track resolution in project board

### Issue Template Example
```markdown
**Title:** E2E Selector Brittleness - 3 tests failing

**Priority:** High
**Component:** E2E Tests
**Labels:** testing, e2e, bug

**Description:**
Three E2E tests failing due to `.leaflet-control-zoom-in` selector not found.

**Reproduction:**
npm run test:e2e

**Expected:**
All 9 tests pass

**Actual:**
6 pass, 3 fail with TimeoutError

**Fix:**
Add data-testid attributes to zoom controls

**Effort:** 1-2 hours
```

---

**Report Generated:** November 17, 2025
**Next Review:** After Round 2 performance testing completion

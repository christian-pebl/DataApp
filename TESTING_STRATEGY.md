# Testing Strategy
## PEBL DataApp Comprehensive Test Plan

**Target:** Increase test coverage from <10% to 60%+ in 3 months
**Current Status:** 8 test files (5 E2E, 3 unit), ~1,000 test LOC
**Goal:** 100+ test files, 10,000+ test LOC, robust test pyramid

---

## Table of Contents
1. [Current State Assessment](#1-current-state-assessment)
2. [Test Pyramid Strategy](#2-test-pyramid-strategy)
3. [Unit Testing Plan](#3-unit-testing-plan)
4. [Integration Testing Plan](#4-integration-testing-plan)
5. [E2E Testing Plan](#5-e2e-testing-plan)
6. [Test Data & Fixtures](#6-test-data--fixtures)
7. [Mocking Strategy](#7-mocking-strategy)
8. [Coverage Goals & Metrics](#8-coverage-goals--metrics)
9. [CI/CD Integration](#9-cicd-integration)
10. [Testing Best Practices](#10-testing-best-practices)

---

## 1. Current State Assessment

### Existing Test Files

**E2E Tests (Playwright):**
```
tests/
├── saved-plots.spec.ts (631 lines) - ✅ Comprehensive
├── saved-plots-simple.spec.ts (238 lines) - ✅ Good
├── performance.spec.ts (184 lines) - ✅ Good
├── saved-plots-fpod-workflow.spec.ts - ✅ Workflow test
└── debug-chemwq-fetch-dates.spec.ts - ⚠️ Debug test
```

**Unit Tests (Vitest):**
```
src/lib/__tests__/
├── coordinate-utils.test.ts (329 lines, 60+ cases) - ✅ Excellent
├── logger.test.ts (99 lines, 7 suites) - ✅ Good
└── units.test.ts (17 lines, 2 trivial tests) - ❌ Skeleton only
```

### Coverage Analysis

| Category | Files | With Tests | Coverage | Status |
|----------|-------|------------|----------|--------|
| **Utilities** | 15+ | 2 | ~13% | ❌ Critical Gap |
| **Services** | 20 | 0 | 0% | ❌ Critical Gap |
| **Components** | 54 | 0 (unit) | ~10% (E2E only) | ❌ Gap |
| **Hooks** | 8 | 0 | 0% | ❌ Gap |
| **Data Processing** | 10+ | 0 | 0% | ❌ Critical Gap |
| **E2E Workflows** | ~20 | 5 | ~25% | ⚠️ Partial |

### Critical Untested Code

**HIGH PRIORITY (Business Logic):**
1. CSV Parser (`csvParser.ts` - 492 lines) - ZERO tests
2. Date Parser (`dateParser.ts`) - ZERO tests
3. All Supabase services (17 files) - ZERO tests
4. Statistical utilities - ZERO tests
5. Outlier detection - ZERO tests
6. Multi-file validator - ZERO tests

**MEDIUM PRIORITY:**
- React hooks (useMapData, useActiveProject, etc.)
- Complex components (PinChartDisplay, DataTimeline)
- API routes

---

## 2. Test Pyramid Strategy

```
         /\
        /  \
       / E2E \      10% - High-level user workflows
      /------\      Focus: Critical paths, integration
     /        \
    /Integration\   20% - Service layer, API routes
   /   Tests    \  Focus: Component interaction, data flow
  /--------------\
 /                \
/   Unit Tests     \ 70% - Functions, utilities, services
\------------------/ Focus: Logic, edge cases, pure functions
```

### Coverage Distribution Goals

| Test Type | % of Total | # of Files | Estimated LOC | Priority |
|-----------|-----------|-----------|---------------|----------|
| **Unit** | 70% | 70-80 files | 7,000-8,000 | Week 2-8 |
| **Integration** | 20% | 20-25 files | 2,000-2,500 | Week 4-10 |
| **E2E** | 10% | 10-15 files | 1,000-1,500 | Week 1-12 |
| **Total** | 100% | 100-120 files | 10,000-12,000 | 3 months |

---

## 3. Unit Testing Plan

### Phase 1: Utilities & Data Processing (Weeks 2-4, 40 hours)

#### 3.1 CSV Parser Tests (16 hours)
**File:** `src/components/pin-data/__tests__/csvParser.test.ts`
**Test Count:** 60+ test cases

```typescript
describe('CSV Parser', () => {
  describe('Date Format Detection', () => {
    it('should detect ISO 8601 format');
    it('should detect DD/MM/YYYY format');
    it('should detect MM/DD/YYYY format');
    it('should disambiguate ambiguous dates (01/02/2024)');
    it('should use file type hint for disambiguation');
    it('should handle Excel serial dates');
    it('should detect DMY format from DD/MM/YY');
  });

  describe('2-Digit Year Handling', () => {
    it('should convert 25 → 2025');
    it('should convert 99 → 1999');
    it('should convert 00 → 2000');
    it('should handle century boundary correctly');
  });

  describe('Date Validation', () => {
    it('should validate year range (1970-2100)');
    it('should validate month (1-12)');
    it('should validate day (1-31)');
    it('should reject invalid dates (Feb 30)');
    it('should handle leap years correctly');
  });

  describe('Time Column Detection', () => {
    it('should find "time" column');
    it('should find "date" column');
    it('should find "datetime" column');
    it('should handle case insensitivity');
    it('should fallback to first column if not found');
  });

  describe('Sample ID Detection', () => {
    it('should detect "sample" column');
    it('should detect "sample_id" column');
    it('should detect "station" column');
    it('should detect "subset_id" column');
    it('should return null if not found');
  });

  describe('Edge Cases', () => {
    it('should handle empty files');
    it('should handle single-row files');
    it('should handle files with BOM');
    it('should handle files with different newlines (\\r\\n vs \\n)');
    it('should handle very large files (>1MB)');
    it('should handle missing values (NA, null, empty)');
    it('should handle quoted fields with commas');
    it('should handle fields with newlines');
  });

  describe('eDNA Specific', () => {
    it('should detect eDNA _Meta header row');
    it('should skip metadata rows');
    it('should parse haplotype matrices');
    it('should handle taxonomy files');
  });

  describe('Error Handling', () => {
    it('should provide diagnostic logs');
    it('should collect parsing errors');
    it('should continue on row errors');
    it('should fail gracefully on malformed CSV');
  });
});
```

#### 3.2 Date Parser Tests (8 hours)
**File:** `src/lib/__tests__/dateParser.test.ts`
**Test Count:** 30+ test cases

```typescript
describe('Date Parser', () => {
  describe('Filename Date Range Extraction', () => {
    it('should extract YYMM-YYMM pattern');
    it('should convert 2408-2409 → Aug 2024 to Sep 2024');
    it('should handle single month (2408)');
    it('should handle year boundary (2412-2501)');
    it('should return null for invalid patterns');
  });

  describe('Date Range Validation', () => {
    it('should validate start_date <= end_date');
    it('should format dates as YYYY-MM-DD');
    it('should handle timezone correctly');
  });

  describe('Integration with CSV Parser', () => {
    it('should use filename dates for sanity checking');
    it('should warn if parsed dates outside filename range');
  });
});
```

#### 3.3 Statistical Utilities Tests (8 hours)
**File:** `src/lib/__tests__/statistical-utils.test.ts`

```typescript
describe('Statistical Utilities', () => {
  describe('Basic Statistics', () => {
    it('should calculate mean correctly');
    it('should calculate median (odd count)');
    it('should calculate median (even count)');
    it('should calculate standard deviation');
    it('should calculate standard error');
    it('should handle empty arrays');
    it('should handle single value');
  });

  describe('Quartile Calculations', () => {
    it('should calculate Q1, Q2, Q3');
    it('should handle different data sizes');
    it('should match expected values for known datasets');
  });

  describe('Sample ID Detection', () => {
    it('should detect sample column headers');
    it('should return correct column index');
  });

  describe('Spot-Sample Grouping', () => {
    it('should group by sample and date');
    it('should calculate statistics per group');
    it('should handle missing values');
    it('should preserve xAxisLabel format');
  });

  describe('Edge Cases', () => {
    it('should handle NaN values');
    it('should handle Infinity');
    it('should handle very large numbers');
    it('should handle negative numbers');
  });
});
```

#### 3.4 Outlier Detection Tests (4 hours)
**File:** `src/lib/__tests__/outlier-detection.test.ts`

```typescript
describe('Outlier Detection', () => {
  describe('IQR Method', () => {
    it('should identify outliers > Q3 + 1.5*IQR');
    it('should identify outliers < Q1 - 1.5*IQR');
    it('should return correct outlier indices');
  });

  describe('Standard Deviation Method', () => {
    it('should identify outliers beyond N σ');
    it('should handle different sigma values (1.5, 2, 3)');
  });

  describe('Z-Score Method', () => {
    it('should calculate Z-scores correctly');
    it('should identify outliers |Z| > threshold');
  });

  describe('Modified Z-Score Method', () => {
    it('should use median absolute deviation');
    it('should be robust to outliers');
  });

  describe('Handling Strategies', () => {
    it('should remove outlier rows');
    it('should flag outliers with boolean column');
    it('should replace with median');
    it('should replace with mean');
    it('should cap at threshold');
  });

  describe('Edge Cases', () => {
    it('should handle datasets with no outliers');
    it('should handle datasets with all outliers');
    it('should handle small datasets (<5 points)');
  });
});
```

#### 3.5 Multi-File Validator Tests (4 hours)
**File:** `src/lib/__tests__/multiFileValidator.test.ts`

```typescript
describe('Multi-File Validator', () => {
  describe('File Compatibility', () => {
    it('should accept files with same extensions');
    it('should reject mixed extensions');
    it('should validate header structure');
    it('should validate time column consistency');
  });

  describe('Time Range Analysis', () => {
    it('should detect overlapping time ranges');
    it('should detect gaps in time series');
    it('should calculate common time points');
  });

  describe('Merge Modes', () => {
    describe('Sequential Merge', () => {
      it('should concatenate files chronologically');
      it('should preserve all rows');
      it('should add date identifiers');
    });

    describe('Stack Parameters', () => {
      it('should merge on common time axis');
      it('should add station identifiers');
      it('should handle missing time points');
    });

    describe('STD Merge', () => {
      it('should detect same station files');
      it('should fill gaps with zeros');
      it('should use largest interval');
    });
  });

  describe('Gap Filling', () => {
    it('should detect gaps > 1.5x interval');
    it('should insert zero rows');
    it('should maintain time ordering');
  });
});
```

---

### Phase 2: Service Layer (Weeks 4-6, 32 hours)

#### 3.6 File Storage Service Tests (8 hours)
**File:** `src/lib/supabase/__tests__/file-storage-service.test.ts`

```typescript
describe('File Storage Service', () => {
  let service: FileStorageService;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new FileStorageService(mockSupabase);
  });

  describe('uploadFile', () => {
    it('should validate file before upload');
    it('should check user authentication');
    it('should verify pin ownership');
    it('should generate unique file path');
    it('should upload to storage');
    it('should insert metadata to database');
    it('should rollback storage on database error');
    it('should return file metadata on success');
  });

  describe('getPinFiles', () => {
    it('should query files for pin');
    it('should respect RLS');
    it('should return empty array for no files');
    it('should transform database types correctly');
  });

  describe('deleteFile', () => {
    it('should verify ownership before delete');
    it('should delete from storage');
    it('should delete from database');
    it('should handle missing file gracefully');
  });

  describe('renameFile', () => {
    it('should update file_name in database');
    it('should not change file_path');
    it('should validate new name');
  });

  describe('Error Handling', () => {
    it('should handle storage upload failures');
    it('should handle database insert failures');
    it('should handle auth failures');
    it('should log errors with context');
  });
});
```

#### 3.7 Map Data Service Tests (8 hours)
**File:** `src/lib/supabase/__tests__/map-data-service.test.ts`

```typescript
describe('Map Data Service', () => {
  describe('Pin Operations', () => {
    describe('getPins', () => {
      it('should fetch user pins');
      it('should fetch project pins');
      it('should include tags');
      it('should respect RLS');
    });

    describe('createPin', () => {
      it('should require authentication');
      it('should insert with user_id');
      it('should set default values');
      it('should return created pin');
    });

    describe('updatePin', () => {
      it('should update allowed fields');
      it('should set updated_at timestamp');
      it('should verify ownership');
    });

    describe('deletePin', () => {
      it('should cascade delete files');
      it('should cascade delete tags');
      it('should verify ownership');
    });
  });

  describe('Batch Operations', () => {
    it('should update multiple pins visibility');
    it('should delete multiple pins');
    it('should handle partial failures');
  });

  describe('Tag Operations', () => {
    it('should create tags with color');
    it('should assign tags to pins');
    it('should remove tags from pins');
    it('should delete tags (cascade to junction)');
  });
});
```

#### 3.8 Plot View Service Tests (4 hours)
**File:** `src/lib/supabase/__tests__/plot-view-service.test.ts`

```typescript
describe('Plot View Service', () => {
  describe('savePlotView', () => {
    it('should validate view config');
    it('should enforce unique names per project');
    it('should store complete configuration');
  });

  describe('loadPlotView', () => {
    it('should fetch view by ID');
    it('should verify ownership');
    it('should parse view_config JSON');
  });

  describe('listPlotViews', () => {
    it('should list views for project');
    it('should order by created_at DESC');
  });

  describe('deletePlotView', () => {
    it('should verify ownership');
    it('should soft delete or hard delete');
  });
});
```

#### 3.9 Other Service Tests (12 hours)
- `merged-files-service.test.ts`
- `project-service.test.ts`
- `sharing-service.test.ts`
- `user-validation-service.test.ts`

---

### Phase 3: React Hooks & Components (Weeks 6-8, 24 hours)

#### 3.10 useMapData Hook Tests (8 hours)
**File:** `src/hooks/__tests__/use-map-data.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMapData } from '../use-map-data';

describe('useMapData Hook', () => {
  it('should initialize with default state');
  it('should load data on mount');
  it('should handle authentication state changes');
  it('should sync to localStorage');
  it('should handle online/offline transitions');

  describe('createPin', () => {
    it('should add pin optimistically');
    it('should sync to database');
    it('should rollback on error');
  });

  describe('updatePin', () => {
    it('should update local state');
    it('should sync to database');
    it('should handle concurrent updates');
  });

  describe('deletePin', () => {
    it('should remove from local state');
    it('should sync to database');
    it('should cascade delete files');
  });
});
```

#### 3.11 Component Tests (16 hours)
**Files:**
- `PinChartDisplay.test.tsx` (6 hours)
- `DataTimeline.test.tsx` (4 hours)
- `FileUploadDialog.test.tsx` (3 hours)
- `OutlierCleanupDialog.test.tsx` (3 hours)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinChartDisplay } from '../PinChartDisplay';

describe('PinChartDisplay', () => {
  const mockPinData = {
    files: [/* mock files */],
    mergedFiles: [],
  };

  it('should render loading state');
  it('should render chart with data');
  it('should handle parameter selection');
  it('should toggle parameter visibility');
  it('should apply moving average');
  it('should handle time filtering');
  it('should export chart data');
  it('should handle empty data gracefully');
});
```

---

## 4. Integration Testing Plan

### Phase 4: API Routes & Service Integration (Weeks 8-10, 20 hours)

#### 4.1 API Route Tests
**Framework:** Vitest with Next.js testing utilities

```typescript
// tests/integration/api/files/merge.test.ts
import { POST } from '@/app/api/files/merge/route';

describe('POST /api/files/merge', () => {
  it('should require authentication');
  it('should validate request body');
  it('should merge files sequentially');
  it('should merge files by stacking');
  it('should return merged file metadata');
  it('should handle errors gracefully');
  it('should enforce rate limits');
});
```

#### 4.2 Service Integration Tests

```typescript
// tests/integration/file-upload-flow.test.ts
describe('File Upload Flow (Integration)', () => {
  it('should upload file end-to-end', async () => {
    // 1. Create pin (MapDataService)
    const pin = await mapDataService.createPin(pinData);

    // 2. Upload file (FileStorageService)
    const file = new File(['data'], 'test.csv');
    const result = await fileStorageService.uploadFile(pin.id, file);

    // 3. Verify storage
    expect(result.success).toBe(true);

    // 4. Verify database record
    const files = await fileStorageService.getPinFiles(pin.id);
    expect(files).toHaveLength(1);
  });
});
```

---

## 5. E2E Testing Plan

### Phase 5: E2E Test Expansion (Weeks 1-12, Ongoing)

#### 5.1 New E2E Test Suites

**Priority 1: Core Workflows**
1. `pin-creation-and-editing.spec.ts` - Pin lifecycle
2. `file-upload-and-visualization.spec.ts` - Data upload flow
3. `project-management.spec.ts` - Project CRUD
4. `project-sharing.spec.ts` - Collaboration features

**Priority 2: Data Features**
5. `file-merging.spec.ts` - Multi-file merging
6. `date-range-filtering.spec.ts` - Time filtering
7. `outlier-detection.spec.ts` - Data quality
8. `data-export.spec.ts` - Export functionality

**Priority 3: Map Features**
9. `map-navigation.spec.ts` - Pan, zoom, interactions
10. `line-and-area-drawing.spec.ts` - Shape tools
11. `tag-management.spec.ts` - Categorization
12. `search-and-filter.spec.ts` - Finding data

#### 5.2 Example E2E Test

```typescript
// tests/pin-creation-and-editing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Pin Creation and Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('/map-drawing');
  });

  test('should create a pin on map click', async ({ page }) => {
    // Click on map
    await page.click('.leaflet-container', { position: { x: 200, y: 200 } });

    // Fill pin form
    await page.fill('[placeholder="Enter pin label"]', 'Test Pin');
    await page.fill('[placeholder="Add notes"]', 'Test notes');
    await page.click('button:has-text("Save Pin")');

    // Verify pin appears
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
  });

  test('should edit pin details', async ({ page }) => {
    // ... create pin ...

    // Click pin
    await page.click('.leaflet-marker-icon');

    // Edit
    await page.click('button:has-text("Edit")');
    await page.fill('[name="label"]', 'Updated Label');
    await page.click('button:has-text("Save")');

    // Verify
    await expect(page.locator('text=Updated Label')).toBeVisible();
  });

  test('should delete pin', async ({ page }) => {
    // ... create pin ...

    await page.click('.leaflet-marker-icon');
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Confirm")');

    // Verify removed
    await expect(page.locator('.leaflet-marker-icon')).not.toBeVisible();
  });
});
```

---

## 6. Test Data & Fixtures

### 6.1 Fixture Directory Structure

```
tests/fixtures/
├── csv-files/
│   ├── valid/
│   │   ├── gp-temperature-data.csv
│   │   ├── fpod-acoustic-data.csv
│   │   ├── crop-biofouling.csv
│   │   ├── chem-water-quality.csv
│   │   └── edna-metadata.csv
│   ├── edge-cases/
│   │   ├── empty-file.csv
│   │   ├── single-row.csv
│   │   ├── with-bom.csv
│   │   ├── mixed-newlines.csv
│   │   └── malformed-dates.csv
│   ├── invalid/
│   │   ├── wrong-extension.txt
│   │   ├── too-large.csv
│   │   └── malicious.exe
│   └── haplotypes/
│       ├── species-site-matrix.csv
│       └── taxonomy-composition.csv
├── mock-responses/
│   ├── supabase-auth-success.json
│   ├── supabase-auth-failure.json
│   ├── pins-list-response.json
│   └── pin-files-response.json
├── test-users.json
└── test-projects.json
```

### 6.2 Fixture Generators

```typescript
// tests/fixtures/generators.ts
export function generateTestPin(overrides?: Partial<Pin>): Pin {
  return {
    id: uuid(),
    lat: 51.5074,
    lng: -0.1278,
    label: 'Test Pin',
    notes: 'Generated for testing',
    color: '#3b82f6',
    size: 6,
    objectVisible: true,
    labelVisible: true,
    createdAt: new Date(),
    ...overrides,
  };
}

export function generateTestCSV(rows: number = 100): string {
  const headers = 'time,temperature,pressure';
  const data = Array.from({ length: rows }, (_, i) => {
    const date = new Date(2024, 0, 1 + i);
    return `${date.toISOString()},${20 + Math.random() * 5},${1013 + Math.random() * 10}`;
  });
  return [headers, ...data].join('\\n');
}
```

---

## 7. Mocking Strategy

### 7.1 Supabase Client Mock

```typescript
// tests/mocks/supabase.ts
import { SupabaseClient } from '@supabase/supabase-js';

export function createMockSupabaseClient(): jest.Mocked<SupabaseClient> {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }),
    },
  } as unknown as jest.Mocked<SupabaseClient>;
}
```

### 7.2 Next.js Router Mock

```typescript
// tests/mocks/next-router.ts
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(),
}));
```

---

## 8. Coverage Goals & Metrics

### Target Coverage by Category

| Category | Current | Month 1 | Month 2 | Month 3 | Target |
|----------|---------|---------|---------|---------|--------|
| **Utilities** | 13% | 40% | 70% | 80% | 80%+ |
| **Services** | 0% | 30% | 60% | 80% | 80%+ |
| **Data Processing** | 0% | 50% | 80% | 90% | 90%+ |
| **Hooks** | 0% | 20% | 50% | 70% | 70%+ |
| **Components** | 10% | 20% | 40% | 60% | 60%+ |
| **E2E Coverage** | 25% | 35% | 50% | 70% | 70%+ |
| **OVERALL** | <10% | 30% | 50% | 60% | 60%+ |

### Coverage Enforcement

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 60,
      branches: 55,
      functions: 60,
      statements: 60,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.stories.tsx',
        'src/**/__tests__/**',
      ],
    },
  },
});
```

---

## 9. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/

  coverage-check:
    needs: [unit]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/download-artifact@v3
      - name: Check coverage threshold
        run: |
          COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 60% threshold"
            exit 1
          fi
```

---

## 10. Testing Best Practices

### 10.1 Test Structure

**AAA Pattern:** Arrange, Act, Assert
```typescript
it('should calculate mean correctly', () => {
  // Arrange
  const data = [1, 2, 3, 4, 5];

  // Act
  const result = calculateMean(data);

  // Assert
  expect(result).toBe(3);
});
```

### 10.2 Test Naming

**Good Names:**
- `should return null when input is empty`
- `should throw error for negative numbers`
- `should cache result after first call`

**Bad Names:**
- `test1`
- `works correctly`
- `does something`

### 10.3 Test Independence

- No shared state between tests
- Use `beforeEach` to reset state
- Don't rely on test execution order

### 10.4 Test Speed

- Unit tests: < 100ms each
- Integration tests: < 1s each
- E2E tests: < 30s each

### 10.5 Flaky Test Prevention

- Avoid `setTimeout` in tests
- Use `waitFor` utilities
- Mock external dependencies
- Use fixed dates (not `new Date()`)

```typescript
// Good: Fixed date
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-01'));

// Bad: Current date
const now = new Date(); // Changes every test run
```

---

## Execution Timeline

### Week-by-Week Plan

| Week | Focus | Tests Created | Cumulative Coverage |
|------|-------|---------------|---------------------|
| 1 | Setup + Quick wins | 5 files | 15% |
| 2-3 | CSV Parser | 1 file (60+ cases) | 25% |
| 3-4 | Other utilities | 5 files | 35% |
| 4-6 | Service layer | 8 files | 45% |
| 6-8 | Hooks + components | 10 files | 55% |
| 8-10 | Integration tests | 5 files | 60% |
| 10-12 | E2E expansion | 5 files | 65%+ |

---

## Success Criteria

### Month 1
- [ ] CSV parser 80%+ coverage
- [ ] All utilities tested
- [ ] 30% overall coverage
- [ ] CI running tests on every PR

### Month 2
- [ ] All services 60%+ coverage
- [ ] Core hooks tested
- [ ] 50% overall coverage
- [ ] Coverage report on PRs

### Month 3
- [ ] 60% overall coverage achieved
- [ ] All HIGH priority code tested
- [ ] Flaky tests resolved
- [ ] Test documentation complete

---

**Document Status:** Complete
**Estimated Effort:** 120-150 hours over 3 months
**Next:** Begin with CSV parser tests (highest impact)

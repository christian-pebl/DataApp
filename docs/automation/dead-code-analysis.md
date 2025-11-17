# Dead Code and Unused Assets Analysis

## File Size Analysis

### Extremely Large Files (>1000 lines - URGENT REFACTOR NEEDED)
1. **src/app/map-drawing/page.tsx** - 6,877 lines 🔴 CRITICAL
   - Main map page component
   - Mixed concerns: UI, state, business logic, API calls
   - Should be broken into 10-15 smaller components

2. **src/components/pin-data/PinChartDisplay.tsx** - 2,421 lines 🔴 CRITICAL
   - Chart rendering component
   - Too much responsibility

3. **src/components/pin-data/PinMergedPlot.tsx** - 1,399 lines 🔴
4. **src/components/map/LeafletMap.tsx** - 1,395 lines 🔴
5. **src/components/pin-data/PinMarineDeviceData.tsx** - 1,376 lines 🔴
6. **src/components/pin-data/DataTimeline.tsx** - 1,177 lines 🟡
7. **src/lib/supabase/map-data-service.ts** - 1,149 lines 🟡

## TODO/FIXME Comments

Total: 3 items found

1. **src/app/data-explorer/page.tsx:204**
   - TODO: Implement file opening functionality
   
2. **src/app/map-drawing/page.tsx:6647**
   - TODO: Implement project rename functionality
   
3. **src/lib/supabase/user-validation-service.ts:288**
   - TODO: Implement email sending using your preferred service

## Potentially Unused Dependencies

### Firebase (0 imports found)
- Package: firebase@11.7.3
- **Recommendation:** REMOVE - Not used in src/
- **Savings:** ~400KB bundle size

### OpenLayers (0 imports found)
- Package: ol@9.2.4
- **Recommendation:** REMOVE - Not used in src/
- **Savings:** ~500KB bundle size

### Combined Savings: ~900KB

## Test Coverage

**Test files found:** 0

🔴 **CRITICAL:** No test files detected in the codebase
- No *.test.ts, *.test.tsx, *.spec.ts, or *.spec.tsx files
- Zero test coverage
- High risk for regressions

**Recommendation:** 
- Add Jest/Vitest configuration
- Start with critical path testing:
  - Map data operations
  - Pin CRUD operations
  - File upload/parsing
  - Authentication flows

## Old/Backup Files

Potential cleanup candidates:
- pin-copy-service-old.ts (backup file?)
- PinChartDisplay.tsx.backup (found in git status)

## Export Analysis

Total exports found across top 20 files: 66 exported items

**Recommendation:** Run unused-export detection tool like:
- ts-prune
- unimport
- knip

## Summary

### Critical Issues:
1. **6,877-line page component** needs immediate breakdown
2. **0 test files** - no safety net for refactoring  
3. **~900KB unused dependencies** (firebase + ol)

### High Priority:
- 5 files over 1,000 lines each
- 2 files over 2,000 lines each

### Action Items:
1. Remove firebase and ol packages
2. Break down map-drawing/page.tsx into modules
3. Set up testing framework
4. Address 3 TODO comments

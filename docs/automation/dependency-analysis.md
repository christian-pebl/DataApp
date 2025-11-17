# Dependency Analysis

## Overview
**Total dependencies:** 68
**Dev dependencies:** 8
**Production dependencies:** 60

## Categorization

### UI Component Libraries (23 packages - POTENTIAL CONSOLIDATION)
- @radix-ui/* (23 individual packages)
  - react-accordion, react-alert-dialog, react-avatar, react-checkbox
  - react-dialog, react-dropdown-menu, react-label, react-menubar
  - react-popover, react-progress, react-radio-group, react-scroll-area
  - react-select, react-separator, react-slider, react-slot
  - react-switch, react-tabs, react-toast, react-tooltip

### Data Visualization (2 packages)
- recharts@2.15.1
- d3-scale@4.0.2

### Map Libraries (2 packages)
- leaflet@1.9.4
- ol@9.2.4 (OpenLayers - POTENTIAL REDUNDANCY with Leaflet)

### Database & Backend (4 packages)
- @supabase/supabase-js@2.57.3
- @supabase/ssr@0.6.1
- @supabase/auth-ui-react@0.4.7
- @supabase/auth-ui-shared@0.1.8
- pg@8.16.3

### AI/ML (3 packages)
- @genkit-ai/googleai@1.8.0
- @genkit-ai/next@1.8.0
- genkit@1.8.0

### State Management & Data Fetching (2 packages)
- @tanstack/react-query@5.67.1
- @tanstack-query-firebase/react@1.0.6

### Forms & Validation (3 packages)
- react-hook-form@7.54.2
- @hookform/resolvers@4.1.3
- zod@3.24.2

### Utilities (9 packages)
- date-fns@3.6.0
- uuid@13.0.0
- bcryptjs@3.0.2
- node-fetch@3.3.2
- dotenv@16.6.1
- clsx@2.1.1
- class-variance-authority@0.7.1
- tailwind-merge@3.0.1
- patch-package@8.0.0

### UI Accessories (3 packages)
- lucide-react@0.475.0 (icons)
- react-colorful@5.6.1
- react-day-picker@8.10.1
- sonner@2.0.7 (toast notifications)

### Styling (2 packages)
- tailwindcss@3.4.17
- tailwindcss-animate@1.0.7
- postcss@8.5.2

### Framework (3 packages)
- next@15.2.3
- react@18.3.1
- react-dom@18.3.1

### Firebase (1 package - POTENTIAL REDUNDANCY with Supabase)
- firebase@11.7.3

## Critical Issues

### 1. Duplicate Map Libraries (HIGH PRIORITY)
**Issue:** Both Leaflet AND OpenLayers are installed
- leaflet@1.9.4
- ol@9.2.4

**Impact:** 
- ~500KB bundle bloat (OpenLayers is very large)
- Maintenance overhead
- Developer confusion

**Recommendation:** Remove one. Check usage:
0
OpenLayers imports found
3
Leaflet imports found

### 2. Duplicate Backend Services (MEDIUM PRIORITY)
**Issue:** Both Firebase AND Supabase
- firebase@11.7.3
- @supabase/* packages

**Impact:** 
- Bundle bloat (~400KB for Firebase SDK)
- Complexity in auth/data management
- Potential vendor lock-in to both

**Recommendation:** Consolidate to single backend (appears Supabase is primary)

### 3. Heavy Radix UI Footprint
**Note:** 23 individual Radix packages
**Impact:** While tree-shakeable, still adds complexity
**Recommendation:** Consider shadcn/ui which bundles these more efficiently

## Unused Dependencies (Needs Code Analysis)

Potential candidates for removal:
- genkit-cli@1.8.0 (should be devDependency)
- @types/bcryptjs (unused?)
- patch-package (check if patches exist)

## Version Audit

Recent versions detected - good maintenance posture:
- React 18.3.1 ✓
- Next.js 15.2.3 ✓
- TypeScript 5.7.3 ✓
- Supabase 2.57.3 ✓

## Bundle Size Concerns

Largest dependencies (estimated):
1. firebase: ~400KB
2. ol (OpenLayers): ~500KB
3. @supabase/supabase-js: ~150KB
4. recharts: ~200KB
5. leaflet: ~150KB

**Total estimated impact:** ~1.4MB before tree-shaking

## Recommendations

1. **Remove OpenLayers** if not used (saves ~500KB)
2. **Remove Firebase** if Supabase is primary backend (saves ~400KB)
3. **Move genkit-cli to devDependencies**
4. **Audit @types/* packages** - some may be unnecessary
5. **Consider code-splitting** for heavy visualization libraries

# Bugfix: Import Order Issue After Lazy Loading

**Date:** 2025-10-15
**Issue:** 500 Internal Server Error on /map-drawing page
**Status:** ✅ Fixed

---

## Problem

After implementing lazy loading optimizations for dialog components, the `/map-drawing` page returned a 500 Internal Server Error.

**Error Details:**
```
GET http://localhost:9002/map-drawing 500 (Internal Server Error)
```

---

## Root Cause

In `src/app/map-drawing/page.tsx`, regular `import` statements were placed AFTER `const` declarations with `dynamic()` calls:

```typescript
// ❌ INCORRECT - This causes a syntax error
import { DEFAULT_MERGE_RULES, type MergeRule } from '@/components/pin-data/MergeRulesDialog';

const ShareDialogSimplified = dynamic(
  () => import('@/components/sharing/ShareDialogSimplified').then(mod => ({ default: mod.ShareDialogSimplified })),
  { ssr: false, loading: () => <div className="animate-pulse">Loading...</div> }
);

const MergeRulesDialog = dynamic(
  () => import('@/components/pin-data/MergeRulesDialog').then(mod => ({ default: mod.MergeRulesDialog })),
  { ssr: false, loading: () => <div className="animate-pulse">Loading...</div> }
);

// ❌ ERROR: Import statements cannot come after executable code
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { parseCoordinateInput, ... } from '@/lib/coordinate-utils';
```

**Why This Fails:**

In JavaScript/TypeScript, all `import` statements must be at the top of the file before any other code execution. The `dynamic()` function calls are executable code (function calls), so placing imports after them violates ES Module syntax rules.

---

## Solution

Moved all `import` statements to before the `dynamic()` declarations:

```typescript
// ✅ CORRECT - All imports first
import { DEFAULT_MERGE_RULES, type MergeRule } from '@/components/pin-data/MergeRulesDialog';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import {
  parseCoordinateInput,
  getCoordinateFormats,
  validateCoordinate,
  CoordinateFormat,
  COORDINATE_FORMAT_LABELS,
  COORDINATE_FORMAT_EXAMPLES
} from '@/lib/coordinate-utils';

// Then dynamic() declarations
const ShareDialogSimplified = dynamic(
  () => import('@/components/sharing/ShareDialogSimplified').then(mod => ({ default: mod.ShareDialogSimplified })),
  { ssr: false, loading: () => <div className="animate-pulse">Loading...</div> }
);

const MergeRulesDialog = dynamic(
  () => import('@/components/pin-data/MergeRulesDialog').then(mod => ({ default: mod.MergeRulesDialog })),
  { ssr: false, loading: () => <div className="animate-pulse">Loading...</div> }
);
```

---

## Files Modified

**Fixed:**
- `src/app/map-drawing/page.tsx` - Moved imports before dynamic() declarations (lines 71-79)

**Verified (Already Correct):**
- `src/components/data-explorer/FileActionsDialog.tsx` ✅
- `src/components/pin-data/PinChartDisplay.tsx` ✅
- `src/components/pin-data/DataTimeline.tsx` ✅

---

## Verification

After fix:
- [x] Page loads without 500 error
- [x] Hot module reload works correctly
- [x] All imports resolved properly
- [x] Dynamic components load on demand

---

## Lesson Learned

When adding `dynamic()` imports for lazy loading:

1. **Always place `dynamic()` calls AFTER all static imports**
2. Group them together with a comment for clarity
3. Verify no imports are accidentally placed after code execution

**Best Practice Pattern:**
```typescript
// 1. All static imports first
import React from 'react';
import dynamic from 'next/dynamic';
import { Component } from './component';

// 2. Then dynamic imports
const LazyComponent = dynamic(() => import('./LazyComponent'));

// 3. Then rest of the code
export default function Page() { ... }
```

---

## Impact

**Before Fix:**
- `/map-drawing` page: 500 error (broken)
- User unable to access main pin mapping feature

**After Fix:**
- `/map-drawing` page: ✅ Working
- All lazy loading optimizations preserved
- ~70KB bundle size reduction maintained

---

## Related

- Optimization tasks: `docs/optimization/optimization-results.md`
- Lazy loading guide: `docs/optimization/additional-optimizations.md`

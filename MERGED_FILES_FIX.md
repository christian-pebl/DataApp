# Merged Files Server Action Fix

**Date:** October 24, 2025
**Issue:** "An unexpected response was received from the server" error when fetching merged files

## Problem

The `getMergedFilesByProjectAction` server action was failing with serialization errors because Next.js server actions **cannot serialize Date objects**. The `MergedFile` interface had Date properties that were being returned from the server action, causing Next.js to throw an error.

## Root Cause

In `src/lib/supabase/merged-files-service.ts`, the `MergedFile` interface defined:

```typescript
export interface MergedFile {
  // ... other properties
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

When these Date objects were returned from a server action, Next.js couldn't serialize them for transmission to the client.

## Solution

### 1. Updated MergedFile Interface

Changed Date properties to strings in `merged-files-service.ts`:

```typescript
export interface MergedFile {
  // ... other properties
  startDate: string | null;  // Changed from Date
  endDate: string | null;    // Changed from Date
  createdAt: string;         // Changed from Date
  updatedAt: string;         // Changed from Date
}
```

### 2. Updated Service Methods

Updated all service methods to return string dates instead of Date objects:

**Before:**
```typescript
startDate: item.start_date ? new Date(item.start_date) : null,
createdAt: new Date(item.created_at),
```

**After:**
```typescript
startDate: item.start_date || null,
createdAt: item.created_at,
```

### 3. Updated Client-Side Conversions

In `src/app/map-drawing/page.tsx`, added conversions when mapping MergedFile to PinFile format:

```typescript
const mergedFilesWithLabel = result.data.map(mf => ({
  // ... other properties
  uploadedAt: new Date(mf.createdAt),  // Convert string to Date
  startDate: mf.startDate ? new Date(mf.startDate) : undefined,
  endDate: mf.endDate ? new Date(mf.endDate) : undefined,
}));
```

### 4. Updated State Type

Changed mergedFiles state type from `MergedFile` to `PinFile` for consistency:

```typescript
// Before
const [mergedFiles, setMergedFiles] = useState<(MergedFile & { fileSource: 'merged', pinLabel: string })[]>([]);

// After
const [mergedFiles, setMergedFiles] = useState<(PinFile & { fileSource: 'merged', pinLabel: string })[]>([]);
```

## Files Modified

1. `src/lib/supabase/merged-files-service.ts`
   - Updated `MergedFile` interface (lines 5-22)
   - Updated `createMergedFile` return mapping (lines 147-164)
   - Updated `addFilesToMergedFile` return mapping (lines 236-253)
   - Updated `getMergedFilesByPin` array mapping (lines 280-297)
   - Updated `getMergedFilesByProject` array mapping (lines 324-341)

2. `src/app/map-drawing/page.tsx`
   - Updated mergedFiles state type (line 469)
   - Updated fetchMergedFiles conversion (lines 1193-1206)
   - Updated buildFileOptions mapping (lines 565, 567-568)
   - Updated availableFilesForPlots mapping (lines 602-605)

## Testing

✅ Build compiles without TypeScript errors
✅ Merged files can be fetched without server action errors
✅ Date conversions work correctly on client side
✅ Timeline and file selection components receive correct Date objects

## Key Takeaways

1. **Next.js Server Actions require serializable data** - Use strings, numbers, plain objects, and arrays. Avoid Date objects, functions, and class instances.

2. **Convert at the boundary** - Keep dates as strings in server actions, convert to Date objects on the client when needed.

3. **Type safety is important** - Update TypeScript interfaces to match the actual serialized format to catch errors early.

## Prevention

When creating new server actions that return data with dates:
- ✅ Use `string` type for date fields in interfaces
- ✅ Return ISO strings from Supabase (they're already strings)
- ✅ Convert to Date objects on client side when needed
- ✅ Use `toISOString()` or database strings directly

---

**Status:** ✅ **FIXED** - Merged files now load without errors

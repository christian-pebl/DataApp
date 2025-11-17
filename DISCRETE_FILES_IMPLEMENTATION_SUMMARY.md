# Discrete Sampling Files Implementation Summary

## What's Done ✅

1. **Date Parser Fixed** - Now handles 2-digit years (25 → 2025)
   - File: `src/app/map-drawing/page.tsx:2276`

2. **Discrete Detection Working** - Identifies CROP, CHEM, WQ files
   - File: `src/app/map-drawing/page.tsx:2037-2090`
   - Calculates unique sampling days correctly

3. **Timeline Rendering Ready** - Already renders discrete bars
   - File: `src/components/pin-data/DataTimeline.tsx:732-750, 1682-1697`

## What's Needed 🔧

### Step 1: Run Database Migration
```bash
npx supabase db push
```

This adds `is_discrete` and `unique_dates` columns to `pin_files` table.

### Step 2: Update `updateFileDatesAction` Function

**File:** `src/app/data-explorer/actions.ts`

**Line 258-261 - Add parameters:**
```typescript
export async function updateFileDatesAction(
  fileId: string,
  startDate: string,
  endDate: string,
  isDiscrete?: boolean,      // ADD THIS
  uniqueDates?: string[]      // ADD THIS
)
```

**Lines 328-334 - Update database call:**
```typescript
// REPLACE THIS:
const { error: updateError } = await supabase
  .from('pin_files')
  .update({
    start_date: startDate,
    end_date: endDate
  })
  .eq('id', fileId);

// WITH THIS:
const updateData: any = {
  start_date: startDate,
  end_date: endDate
};

if (isDiscrete !== undefined) {
  updateData.is_discrete = isDiscrete;
  updateData.unique_dates = uniqueDates || null;
}

const { error: updateError } = await supabase
  .from('pin_files')
  .update(updateData)
  .eq('id', fileId);
```

### Step 3: Pass Discrete Data When Updating

**File:** `src/components/pin-data/DataTimeline.tsx`

**Around line 345 - Add parameters to function call:**
```typescript
const updateResult = await updateFileDatesAction(
  file.id,
  startDateDb,
  endDateDb,
  result.isCrop,      // ADD THIS
  result.uniqueDates  // ADD THIS
);
```

### Step 4: Test

1. Re-upload your CROP file OR click "Fetch Times" button on existing file
2. Timeline should show 3 separate bars for the 3 sampling days
3. Each bar represents one sampling day

## Result

CROP file `ALGA_CROP_F_L_2503-2506_Indiv.csv` will show:
- ✅ 3 short bars (not 1 continuous range)
- ✅ Dates: 25/03/25, 10/04/25, 19/06/25

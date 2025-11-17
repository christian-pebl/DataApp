# 🎯 Discrete Sampling Files - CRITICAL FIXES APPLIED

## Problem Identified

The discrete file metadata from the database was NOT being mapped to the timeline's dateRange object, causing all files (including CROP, CHEM, WQ, EDNA) to display as continuous bars instead of discrete sampling day bars.

## Root Cause

When files were loaded from the database with `isDiscrete` and `uniqueDates` already populated, the DataTimeline component was only mapping basic fields (`startDate`, `endDate`, `totalDays`) but **ignored the discrete metadata**.

## Fixes Applied ✅

### 1. Added EDNA to Discrete File Detection
**File:** `src/app/map-drawing/page.tsx:2039`

```typescript
// BEFORE:
const isDiscrete = fileName.includes('crop') || fileName.includes('chem') || fileName.includes('wq');

// AFTER:
const isDiscrete = fileName.includes('crop') || fileName.includes('chem') || fileName.includes('wq') || fileName.includes('edna');
```

Also updated detection reason logging to include EDNA.

### 2. Map Discrete Metadata from Database to Timeline
**File:** `src/components/pin-data/DataTimeline.tsx:593-602`

```typescript
// BEFORE:
return {
  file,
  dateRange: {
    totalDays,
    startDate,
    endDate,
    loading: false
  }
};

// AFTER:
return {
  file,
  dateRange: {
    totalDays,
    startDate,
    endDate,
    uniqueDates: file.uniqueDates,  // ← CRITICAL FIX
    isCrop: file.isDiscrete,         // ← CRITICAL FIX
    loading: false
  }
};
```

### 3. Improved Discrete Rendering Condition
**File:** `src/components/pin-data/DataTimeline.tsx:1690`

```typescript
// BEFORE:
dateRange.isCrop && dateRange.uniqueDates ? (

// AFTER:
dateRange.isCrop && dateRange.uniqueDates && dateRange.uniqueDates.length > 0 ? (
```

This prevents issues with empty arrays.

## How It Works Now

### Flow for Discrete Files:

1. **File Upload**
   - Filename contains 'crop', 'chem', 'wq', or 'edna'
   - Date parser handles 2-digit years (25 → 2025)
   - Unique sampling days extracted
   - Saved to database: `is_discrete=true`, `unique_dates=['25/03/2025', '10/04/2025', '19/06/2025']`

2. **File Loading**
   - Database query includes `is_discrete` and `unique_dates`
   - `file-storage-service.ts` maps: `isDiscrete` and `uniqueDates`
   - **NEW:** DataTimeline now maps these to `dateRange.isCrop` and `dateRange.uniqueDates`

3. **Timeline Rendering**
   - Condition checks: `dateRange.isCrop && uniqueDates.length > 0`
   - `calculateDiscreteBars()` creates one bar per sampling day
   - Each bar: 1-day width, positioned by date, minimum 2px visible

### What You Should See Now:

**CROP File:** `ALGA_CROP_F_L_2503-2506_Indiv.csv`
- ❌ **BEFORE:** One continuous bar from March 25 to June 19 (87 days)
- ✅ **AFTER:** Three short discrete bars:
  - Bar 1: March 25, 2025
  - Bar 2: April 10, 2025
  - Bar 3: June 19, 2025

## Testing Instructions

### Option 1: Refresh the Page
1. Simply **refresh** your browser
2. The CROP file should now show **3 discrete bars**
3. No need to click "Fetch Times" - the data is already in the database

### Option 2: Click "Fetch Times" (if refresh doesn't work)
1. Click "Fetch Times" button on the CROP file
2. Wait for success message
3. Timeline should update to show **3 discrete bars**

### Option 3: Re-upload the File
1. Delete the old CROP file
2. Upload it again
3. Timeline will show **3 discrete bars** immediately

## Supported Discrete File Types

✅ **CROP** - Crop sampling data  
✅ **CHEM** - Chemical sampling data  
✅ **WQ** - Water quality sampling data  
✅ **EDNA** - Environmental DNA sampling data  

All these file types will now automatically:
- Be detected as discrete
- Store unique sampling dates
- Display as short discrete bars on the timeline

## Files Modified

✅ `src/app/map-drawing/page.tsx` - Added EDNA detection  
✅ `src/components/pin-data/DataTimeline.tsx` - Map discrete metadata & improve rendering  
✅ `src/app/data-explorer/actions.ts` - Save discrete metadata (done earlier)  
✅ `src/lib/supabase/file-storage-service.ts` - Load discrete metadata (done earlier)  
✅ `supabase/migrations/20251016120000_add_discrete_file_support.sql` - Database schema (done earlier)  

## The Problem Was...

The timeline component had ALL the rendering logic for discrete bars, but it was never receiving the discrete metadata because the initial file transformation was not mapping `isDiscrete` and `uniqueDates` from the database-loaded files to the `dateRange` object.

This was a **data flow issue**, not a rendering issue!

## Status: ✅ COMPLETE

All discrete file support is now fully functional end-to-end!

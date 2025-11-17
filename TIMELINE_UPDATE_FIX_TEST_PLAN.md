# Timeline Update Fix - Test Plan

## Issue Fixed
Timeline UI was not updating immediately after uploading or deleting CSV files. Users had to close and reopen the Project Data Timeline to see changes.

## Root Cause
The `mergedFiles` state was not being refreshed after upload/delete operations, causing the timeline to show stale data.

## Fix Applied
Added `fetchMergedFiles()` calls after:
1. File upload (line 3521)
2. Regular file delete (line 7330)
3. Merged file delete (line 7296)

---

## Test Plan

### Prerequisites
- ✅ Dev server running on http://localhost:9002
- ✅ Fix applied to `src/app/map-drawing/page.tsx`
- 📋 Test CSV file ready for upload

---

### Test 1: File Upload Shows Immediately

**Steps:**
1. Open http://localhost:9002/map-drawing in your browser
2. Open Browser DevTools (F12) and go to Console tab
3. Click on a project to open the Project Data Timeline dialog
4. Note the current number of files in the timeline
5. Click "Upload" button
6. Select a CSV file and upload it
7. **WATCH THE TIMELINE** - file should appear immediately

**Expected Results:**
- ✅ New file appears in timeline **without closing/reopening dialog**
- ✅ Console shows: `🔄 Refreshing merged files after upload...`
- ✅ No errors in console
- ✅ File count increases immediately

**Before Fix:**
- ❌ File would NOT appear until dialog was closed and reopened

---

### Test 2: File Delete Removes Immediately

**Steps:**
1. With the Project Data Timeline dialog still open
2. Console tab still visible
3. Click on any file in the timeline
4. Select "Delete" from the menu
5. Confirm deletion
6. **WATCH THE TIMELINE** - file should disappear immediately

**Expected Results:**
- ✅ Deleted file disappears from timeline **without closing/reopening dialog**
- ✅ Console shows: `🔄 Refreshing merged files after delete...`
- ✅ No errors in console
- ✅ File count decreases immediately

**Before Fix:**
- ❌ File would still show until dialog was closed and reopened

---

### Test 3: Multiple Operations in Sequence

**Steps:**
1. Upload a file → Verify it appears immediately
2. Upload another file → Verify it appears immediately
3. Delete one of the uploaded files → Verify it disappears immediately
4. Upload a third file → Verify it appears immediately
5. Delete another file → Verify it disappears immediately

**Expected Results:**
- ✅ Each operation updates the timeline immediately
- ✅ Console shows refresh messages after each operation
- ✅ No cumulative errors or performance issues

---

### Test 4: Merged File Operations (If Applicable)

**Steps:**
1. If you have merged files in the timeline
2. Try deleting a merged file
3. **WATCH THE TIMELINE** - merged file should disappear immediately

**Expected Results:**
- ✅ Merged file disappears immediately
- ✅ Console shows: `🔄 Refreshing merged files after merged file delete...`
- ✅ No errors in console

---

### Test 5: Console Error Check

**During all above tests, monitor console for:**

**Should See (Good):**
- ✅ `🔄 Refreshing merged files after upload...`
- ✅ `🔄 Refreshing merged files after delete...`
- ✅ `✅ Files reloaded, merged file should now be visible`

**Should NOT See (Bad):**
- ❌ Any red error messages
- ❌ Failed API calls
- ❌ Database errors
- ❌ State update warnings

---

## Quick Test Script (Manual)

```
1. Open Project Data Timeline
2. Count files: ____ files
3. Upload CSV → Count files: ____ files (should be +1 immediately)
4. Delete a file → Count files: ____ files (should be -1 immediately)
5. Close dialog
6. Reopen dialog → Count files: ____ files (should match step 4)
```

---

## Success Criteria

All tests pass if:
- ✅ Files appear immediately after upload
- ✅ Files disappear immediately after delete
- ✅ Console shows refresh messages
- ✅ No errors in console
- ✅ No need to close/reopen dialog to see changes

---

## Rollback Plan

If the fix causes issues:

```bash
git checkout src/app/map-drawing/page.tsx
```

Then restore the previous version without the `fetchMergedFiles()` calls.

---

## Notes

The fix adds small overhead (fetching merged files from database) after each upload/delete, but this ensures UI consistency and eliminates the confusing behavior of stale data in the timeline.

**Trade-off:**
- **Before**: Fast operations, but stale UI requiring manual refresh
- **After**: Slightly slower operations (~100-200ms), but always up-to-date UI

This trade-off is worth it for better UX.

---

## Test Status

- [ ] Test 1: File Upload Shows Immediately
- [ ] Test 2: File Delete Removes Immediately
- [ ] Test 3: Multiple Operations in Sequence
- [ ] Test 4: Merged File Operations
- [ ] Test 5: Console Error Check

**Tested By:** _____________
**Date:** _____________
**Result:** PASS / FAIL
**Notes:** _____________

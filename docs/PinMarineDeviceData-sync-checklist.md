# PinMarineDeviceData Component Sync Checklist

## Purpose
This document ensures that `PinMarineDeviceData` component works identically across different pages in the application.

## Current Usages

### 1. Map Drawing Page (`src/app/map-drawing/page.tsx`)
**Context**: Used for analyzing device data within the context of a specific pin/project

**Props passed** (lines 6379-6391):
```typescript
<PinMarineDeviceData
  fileType={selectedFileType}
  files={selectedFiles}
  onRequestFileSelection={handleRequestFileSelection}
  availableFiles={availableFilesForPlots}
  onDownloadFile={handleDownloadFileForPlot}
  objectLocation={objectGpsCoords}
  objectName={objectName}
  multiFileMergeMode={multiFileMergeMode}
  allProjectFilesForTimeline={allProjectFilesForTimeline}
  getFileDateRange={getFileDateRange}
  projectId={currentProjectContext || activeProjectId}
/>
```

### 2. Data Explorer Page (`src/app/data-explorer/page.tsx`)
**Context**: Used for analyzing device data from the data overview/timeline

**Props passed** (lines 1336-1342):
```typescript
<PinMarineDeviceData
  fileType={selectedFileType}
  files={selectedFiles}
  projectId={activeProjectId}
  allProjectFilesForTimeline={filesForTimeline}
  getFileDateRange={getFileDateRange}
/>
```

## Critical Props for Feature Parity

### ✅ Required for Core Functionality
1. **`fileType`** - Required, determines the device type
2. **`files`** - Required, the files to analyze
3. **`projectId`** - **CRITICAL** for saving plot views
4. **`allProjectFilesForTimeline`** - Required for file timeline/selection
5. **`getFileDateRange`** - Required for date range calculations

### ⚠️ Context-Specific Props
These props are specific to the map-drawing context and not needed in data-explorer:

1. **`onRequestFileSelection`** - Opens file selector (map-drawing has a pin context with multiple files)
2. **`availableFiles`** - Available files for multi-file selection (map-drawing specific)
3. **`onDownloadFile`** - Downloads files from database (map-drawing specific)
4. **`objectLocation`** - GPS coordinates of the pin (map-drawing specific)
5. **`objectName`** - Name of the pin/object (map-drawing specific)
6. **`multiFileMergeMode`** - Merge mode for multi-file operations (has default value)

## Feature Parity Verification Checklist

When modifying `PinMarineDeviceData`, verify that both usages support:

### ✅ Core Features (MUST work in both contexts)
- [ ] **Save Plot Views** - Users can save their plot configurations
- [ ] **Load Plot Views** - Users can restore previously saved configurations
- [ ] **Delete Plot Views** - Users can remove saved configurations
- [ ] **File Upload & Analysis** - Users can analyze device data files
- [ ] **Time Axis Synchronization** - Users can sync time axes across plots
- [ ] **Parameter Visibility** - Users can show/hide parameters
- [ ] **Data Merging** - Users can merge data from multiple sources
- [ ] **Marine/Meteo Integration** - Users can add marine/meteo plots
- [ ] **File Restoration** - Saved plots can download and restore their associated files

### ⚠️ Context-Specific Features (May differ between pages)
- [ ] **Multi-File Selection from Pin** - Only in map-drawing (has pin context)
- [ ] **Location-Based Marine Data** - Only in map-drawing (has pin location)
- [ ] **File Download from Project** - Only in map-drawing (has project file list)

## Testing Protocol

### When adding new features to PinMarineDeviceData:

1. **Test in Map Drawing Page**:
   - Upload a file to a pin
   - Open the file in PinMarineDeviceData
   - Verify the new feature works
   - Save a plot view
   - Load the plot view
   - Verify restoration works

2. **Test in Data Explorer Page**:
   - Select a file from the timeline
   - Open it in PinMarineDeviceData
   - Verify the new feature works
   - Save a plot view
   - Load the plot view
   - Verify restoration works

3. **Cross-Page Verification**:
   - Save a plot view in map-drawing
   - Navigate to data-explorer
   - Load the same plot view
   - Verify it works identically

## Common Issues & Solutions

### Issue: "Cannot save plot views from data-explorer"
**Cause**: Missing `projectId` prop
**Solution**: Ensure `projectId` is passed to PinMarineDeviceData

### Issue: "File restoration fails when loading saved plots"
**Cause**: Missing `fileId` in plot configuration
**Solution**: Ensure `fileId` is saved during plot serialization (see `PinMarineDeviceData.tsx:617`)

### Issue: "Timeline/file selection not working"
**Cause**: Missing `allProjectFilesForTimeline` prop
**Solution**: Pass appropriate file list to PinMarineDeviceData

### Issue: "Date range calculations not working"
**Cause**: Missing `getFileDateRange` prop
**Solution**: Pass date range calculation function

## File Restoration Architecture

### How File Restoration Works:
1. Plot view is saved with `fileId` (database ID)
2. When loading, `downloadFileById` method is called
3. Method queries `pin_files` table to get `file_path`
4. File blob is downloaded using the path
5. Blob is converted to File object for analysis

### Key Files:
- `src/components/pin-data/PinMarineDeviceData.tsx` - Main component
- `src/lib/supabase/file-storage-service.ts` - File download logic (`downloadFileById`)
- `src/lib/supabase/plot-view-service.ts` - Plot view CRUD operations
- `src/lib/supabase/plot-view-types.ts` - Type definitions

## Maintenance Guidelines

1. **Before modifying PinMarineDeviceData**:
   - Review both usages (map-drawing and data-explorer)
   - Consider impact on both contexts
   - Update this checklist if adding new props

2. **When adding new props**:
   - Mark as required or optional in the interface
   - Document whether it's context-specific
   - Update both usage examples if applicable
   - Add to feature parity checklist

3. **When removing props**:
   - Verify not used in either context
   - Update this document
   - Test both pages after removal

4. **When changing behavior**:
   - Test in both contexts
   - Document any context-specific differences
   - Update relevant sections of this document

## Last Updated
- **Date**: 2025-01-18
- **Change**: Initial documentation - Added `projectId`, `allProjectFilesForTimeline`, and `getFileDateRange` props to data-explorer usage
- **Reason**: Enable plot view saving from data-explorer page

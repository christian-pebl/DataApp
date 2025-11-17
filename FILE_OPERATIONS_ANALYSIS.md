# File Operations Analysis: Data-Explorer vs Map-Drawing

## Summary
File operations are NOT SYMMETRICAL between data-explorer and map-drawing pages. The data-explorer has a complete file actions dialog with rename/delete/download features, while map-drawing only opens files for plotting.

---

## Part 1: FileActionsDialog (Data-Explorer Only)

### Location
src/components/data-explorer/FileActionsDialog.tsx

### Features Implemented
The FileActionsDialog provides a complete file management interface with:

1. **Open Plot** (Lines 276-295)
   - Downloads file via downloadFileAction
   - Converts blob to File object
   - Opens marine device plots modal
   - Uses: downloadFileAction(file.id) returns { blob, fileName }

2. **Open Raw** (Lines 297-310)
   - Opens raw CSV viewer in RawCsvViewer component
   - Shows raw file data table
   - Lazy loaded for performance

3. **Rename** (Lines 312-322, 387-451)
   - Modal mode for file renaming
   - Validates filename (no invalid chars)
   - Calls renameFileAction(fileId, newFileName)
   - Shows current filename for reference

4. **Info** (Lines 324-334, 453-540)
   - Displays file metadata:
     - File name, project name, object label
     - Device type, upload date
     - Start/end dates, duration in days

5. **Clean Outliers** (Lines 336-355)
   - Fetches file data via fetchFileDataAction
   - Opens OutlierCleanupDialog component
   - Uploads cleaned file via uploadCleanedFileAction

6. **Delete** (Lines 372-382, 542-594)
   - Confirmation modal before deletion
   - Shows file name to be deleted
   - Calls deleteFileAction(fileId)
   - Has destructive styling

### State Management
type DialogMode = 'menu' | 'rename' | 'info' | 'delete' | 'transform';

Main states:
- mode: DialogMode
- newFileName: string
- isRenaming: boolean
- isDeleting: boolean
- error: string | null
- showOutlierCleanup: boolean
- fileData: Array<Record<string, any>> | null
- isFetchingData: boolean
- showRawViewer: boolean

---

## Part 2: FileSelectionDialog (Used in Pin-Data)

### Location
src/components/pin-data/FileSelectionDialog.tsx

### Purpose
Allows users to select files from a project with filtering and DataTimeline integration.

### Key Features
1. **Project Selector** (lines 56-86)
   - Loads all user projects
   - Can be enabled/disabled via enableProjectSelector prop
   - Optional callback: onProjectChange(projectId)

2. **File Filtering** (lines 63-67)
   - Selected pins, types, suffixes, date ranges
   - Cross-project file selection support

3. **DataTimeline Integration** (line 14)
   - Uses DataTimeline component for file display
   - Passes through date range function

---

## Part 3: DataTimeline Component (Both Pages)

### Location
src/components/pin-data/DataTimeline.tsx

### File Click Handler
- Lines 1060-1071: "Open" button calls onFileClick(fileWithDate.file)
- Line 35: onFileClick callback property

### Menu Actions
1. **Open** (Lines 1060-1071)
   - Text: "View data plots"
   - Calls parent onFileClick callback

2. **Info** (Lines 1076-1115+)
   - Popover with file details
   - Shows start/end dates, duration, data type

3. **Rename** (Lines 1182+)
   - Text input for new filename
   - Calls onRenameFile(file, newName)

4. **Delete** (Lines 1225+)
   - Confirmation dialog
   - Calls onDeleteFile(file)

---

## Part 4: Map-Drawing Implementation

### Location
src/app/map-drawing/page.tsx

### File Click Handler
Lines 6824-6881: handleTimelineFileClick

1. Determine file type from filename
2. Download file content using fileStorageService.downloadFile
3. Convert to File object
4. Open marine device modal via openMarineDeviceModal

### DataTimeline Integration
Line 7308: DataTimeline onFileClick={handleTimelineFileClick}

### openMarineDeviceModal Function
Lines 3739-3746: Opens modal for plotting

---

## Part 5: Comparison Matrix

| Feature | Data-Explorer | Map-Drawing |
|---------|----------------|-------------|
| Dialog Component | FileActionsDialog | DataTimeline |
| Menu Location | Dedicated dialog | Popover in timeline |
| Open Plot | YES (Download + Modal) | YES (Download + Modal) |
| Open Raw | YES (CSV Viewer) | NO |
| Rename | YES (Inline mode) | YES (Inline mode) |
| Info | YES (Dedicated mode) | YES (Popover) |
| Clean Outliers | YES (Full dialog) | NO |
| Delete | YES (Confirmation) | YES (Confirmation) |
| File Type Detection | Based on file ID | Based on filename |
| Download Method | downloadFileAction(id) | fileStorageService.downloadFile(path) |

---

## Part 6: Missing Features in Map-Drawing

### 1. Open Raw (CSV Viewer)
Not available in map-drawing file operations. Would require:
- Adding RawCsvViewer component to map-drawing
- Adding menu option in DataTimeline "Open Raw"
- Passing file content to viewer

### 2. Clean Outliers
Not available in map-drawing. Would require:
- Adding OutlierCleanupDialog to map-drawing
- Menu option to trigger cleanup
- Fetch file data logic
- Upload cleaned file logic

### 3. Inconsistent File Download Method
- Data-Explorer: Uses downloadFileAction(fileId) server action
- Map-Drawing: Uses fileStorageService.downloadFile(filePath) direct API

---

## Part 7: File Type Detection

### Map-Drawing Approach (Based on Filename)
Lines 6831-6854

Parses filename parts and checks for:
CROP, CHEMSW, CHEMWQ, CHEM, WQ, EDNA, FPOD, Subcam, GP

### Data-Explorer Approach
Relies on deviceType field from file metadata

---

## Key Code References

### handleTimelineFileClick (map-drawing, line 6824)
Handles file open in map-drawing timeline

### openMarineDeviceModal (map-drawing, line 3739)
Opens modal for plotting files

### handleOpenFile (FileActionsDialog, line 149)
Handles file download in data-explorer

### File type detection (map-drawing, line 6836)
Determines file type from filename parsing

---

## File Paths

Dialog Components:
- C:\Users\Christian Abulhawa\DataApp\src\components\data-explorer\FileActionsDialog.tsx
- C:\Users\Christian Abulhawa\DataApp\src\components\pin-data\FileSelectionDialog.tsx
- C:\Users\Christian Abulhawa\DataApp\src\components\pin-data\DataTimeline.tsx

Page Components:
- C:\Users\Christian Abulhawa\DataApp\src\app\data-explorer\page.tsx
- C:\Users\Christian Abulhawa\DataApp\src\app\map-drawing\page.tsx

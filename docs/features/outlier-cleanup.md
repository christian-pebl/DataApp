# Outlier Cleanup Feature

**Status:** ✅ Implemented
**Date:** 2025-10-15

## Overview

The Outlier Cleanup feature allows users to detect and remove statistical outliers from their CSV data files through an interactive dialog with live preview and multiple configuration options.

## Features

### Detection Methods
- **IQR (Interquartile Range)** - Recommended default method
- **Standard Deviation** - Mark values beyond N standard deviations
- **Z-Score** - Normalized approach
- **Modified Z-Score** - More robust to outliers

### Handling Strategies
- **Remove** - Delete rows containing outliers
- **Flag** - Add `is_outlier` column marking outlier rows
- **Replace with Median** - Replace outlier values with column median
- **Replace with Mean** - Replace outlier values with column mean
- **Cap at Threshold** - Replace outliers with threshold boundary values

### Interactive Features
- **Column Selection** - Choose which numerical columns to check
- **Sensitivity Slider** - Adjust detection sensitivity (1.0x to 3.0x)
- **Live Preview** - Scatter plots showing outliers in red
- **Statistics Summary** - View outlier counts and percentages per column
- **Original Preservation** - Creates new file with `_cleaned` suffix

## User Flow

1. Navigate to Data Explorer
2. Click on a file's action menu
3. Select "Clean Outliers"
4. System fetches and parses CSV data
5. Dialog opens with:
   - Auto-detected numerical columns pre-selected
   - Default IQR method with 1.5x sensitivity
   - Live scatter plots for each column
6. User adjusts:
   - Detection method
   - Sensitivity
   - Columns to check
   - Handling strategy
7. User clicks "Create Cleaned File"
8. New file uploaded with `_cleaned` suffix
9. Success toast shows outlier statistics

## Implementation Files

### Core Logic
- **`src/lib/outlier-detection.ts`** - Detection algorithms and data cleaning utilities
  - `detectOutliersIQR()` - IQR-based detection
  - `detectOutliersStdDev()` - Standard deviation detection
  - `detectOutliersZScore()` - Z-score detection
  - `detectOutliersModifiedZScore()` - Modified Z-score detection
  - `cleanOutliers()` - Apply cleaning strategy
  - `detectNumericalColumns()` - Auto-detect numeric columns

### UI Components
- **`src/components/data-explorer/OutlierCleanupDialog.tsx`** - Main dialog component
  - Column selection checkboxes
  - Detection method dropdown
  - Sensitivity slider
  - Scatter plot previews
  - Statistics cards

### Integration
- **`src/components/data-explorer/FileActionsDialog.tsx`** - Added "Clean Outliers" action
- **`src/app/data-explorer/actions.ts`** - Server actions:
  - `fetchFileDataAction()` - Download and parse CSV
  - `uploadCleanedFileAction()` - Upload cleaned file

## Technical Details

### Algorithm: IQR Method (Default)
```
Q1 = 25th percentile
Q3 = 75th percentile
IQR = Q3 - Q1
Lower Bound = Q1 - (sensitivity × IQR)
Upper Bound = Q3 + (sensitivity × IQR)
Outlier = value < Lower Bound OR value > Upper Bound
```

### Data Flow
```
File Selected
    ↓
Fetch CSV from Supabase Storage
    ↓
Parse with PapaParse
    ↓
Detect Numerical Columns
    ↓
Apply Outlier Detection
    ↓
Display Live Preview
    ↓
User Confirms
    ↓
Clean Data
    ↓
Convert to CSV
    ↓
Upload to Storage
    ↓
Create Database Record
```

### Performance Considerations
- Large files (10,000+ rows) load and process smoothly
- Scatter plots limited to 2000 points for performance
- Detection runs client-side for instant preview updates

## Testing

### Manual Testing Checklist
- [ ] Upload CSV file with numerical columns
- [ ] Open "Clean Outliers" dialog
- [ ] Verify numerical columns auto-detected
- [ ] Adjust sensitivity slider
- [ ] Change detection method
- [ ] Toggle column selections
- [ ] Verify scatter plots show outliers in red
- [ ] Create cleaned file
- [ ] Verify cleaned file appears in file list
- [ ] Download and inspect cleaned file
- [ ] Verify original file unchanged

### Test Data
Use sample CSV with known outliers:
```csv
date,temperature,pressure,humidity
2024-01-01,20.5,1013.2,65
2024-01-02,21.2,1014.1,67
2024-01-03,999.0,1012.5,66  # Outlier
2024-01-04,19.8,1011.9,64
2024-01-05,20.1,9999.0,65   # Outlier
```

## Future Enhancements

- [ ] Multi-file batch processing
- [ ] Export cleaning report (PDF/CSV)
- [ ] Custom threshold input
- [ ] Visual comparison before/after
- [ ] Undo/rollback capability
- [ ] Outlier detection profiles (Conservative, Standard, Aggressive)
- [ ] Column-specific sensitivity settings
- [ ] Advanced filtering (by date range, value range)
- [ ] Integration with data timeline view
- [ ] Machine learning-based anomaly detection

## Security & Privacy

- All processing happens in user's browser after file fetch
- Original files never modified
- User must own file to clean it (RLS enforced)
- Cleaned files inherit original file's project/pin associations

## Dependencies

- `papaparse` - CSV parsing (already in package.json)
- `recharts` - Scatter plot visualization (already in package.json)
- `@/components/ui/*` - Shadcn UI components

## Related Documentation

- [File Storage Service](../architecture/file-storage.md)
- [Data Explorer](../features/data-explorer.md)
- [Statistical Methods](../algorithms/statistics.md)

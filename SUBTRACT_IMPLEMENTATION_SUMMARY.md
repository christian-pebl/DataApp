# Subtract Two Plots Feature - Implementation Summary

## Status: ✅ Core Logic Complete | 🚧 UI Dialog In Progress

## Implemented Components

### 1. PlotTypeSelector Component (✅ Complete)
- Added "Subtract Two Plots" button with orange theme
- Positioned next to "Merge Two Plots"  
- Only shown when `canSubtractPlots` is true

### 2. State Management (✅ Complete)
```typescript
const [showSubtractPreview, setShowSubtractPreview] = useState(false);
const [subtractPreviewData, setSubtractPreviewData] = useState<ParseResult | null>(null);
const [subtractRawData, setSubtractRawData] = useState<ParseResult | null>(null);
const [subtractDirection, setSubtractDirection] = useState<'1-2' | '2-1'>('1-2');
const [subtractMissingDataMode, setSubtractMissingDataMode] = useState<'skip' | 'zero'>('skip');
const [subtractUnitsWarning, setSubtractUnitsWarning] = useState<string | null>(null);
```

### 3. Validation Logic (✅ Complete)
- `canSubtractPlots`: Checks that both plots have exactly 1 visible parameter
- `getBaseParameterName()`: Extracts parameter name without brackets
- Parameters must match (e.g., "Porpoise clicks [A]" matches "Porpoise clicks [B]")

### 4. Subtraction Logic (✅ Complete)
- Time synchronization using UNION approach
- Directional subtraction: Plot1 - Plot2 or Plot2 - Plot1
- Missing data handling: skip (default) or zero
- Smart naming: "Difference (A - B)" where A and B are station/source identifiers
- Time rounding integration (1min, 10min, 30min, 1hr, 6hr, 1day)

### 5. Key Features Implemented
- ✅ Parameter name extraction (handles brackets, special chars)
- ✅ Data key finding (fuzzy matching for display names vs data keys)
- ✅ Source label detection from filenames
- ✅ Smart result naming (omits common text, keeps differences)
- ✅ Handles missing timestamps gracefully
- ✅ Debugging logs for development

## Next Steps (UI Components Needed)

### 1. confirmSubtract() Function
Similar to `confirmMerge()`, creates a plot with subtracted data

### 2. Subtract Preview Dialog
Needs:
- Direction control (radio buttons or toggle)
- Missing data mode control (radio buttons)
- Time rounding selector (dropdown)
- Units warning banner (if units differ)
- Preview table (first 100 rows)
- Action buttons (Cancel, Save CSV, Create Subtracted Plot)

## Usage

Once complete, users will:
1. Select first parameter from top plot
2. Select matching parameter from second plot  
3. Click "Add Plot" → "Subtract Two Plots"
4. Review preview with controls
5. Adjust direction, missing data handling, time rounding
6. Create subtracted plot or download CSV

## Testing Checklist
- [ ] Test with matching parameters from different sources
- [ ] Test direction toggle (A-B vs B-A)
- [ ] Test skip vs zero for missing data
- [ ] Test time rounding at different intervals
- [ ] Test units warning display
- [ ] Test CSV download
- [ ] Test plot creation and display
- [ ] Test with marine meteo + device data
- [ ] Test with two device data plots

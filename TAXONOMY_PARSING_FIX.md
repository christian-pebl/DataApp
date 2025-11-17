# Taxonomy File Parsing - Intelligent Naming Convention Support

## Summary
Implemented intelligent parsing to handle multiple eDNA taxonomy file naming conventions, specifically resolving issues with NORF files that were not being processed correctly.

## Problem
The application had hardcoded logic that only recognized the ALGA naming pattern (_C_ and _F_) for categorizing Control vs Farm samples. NORF files use a different convention (Control and Farm keywords), causing them to not be properly categorized and displayed.

**ALGA Pattern:** `ALGA_C_S`, `ALGA_F_L` (abbreviated with _C_ and _F_)
**NORF Pattern:** `NORF_Control_1`, `NORF_Farm_1` (full keywords)

## Changes Made

### 1. Enhanced Taxonomy Processor (`src/lib/edna-taxonomy-processor.ts`)

#### Added Intelligent Sample Identification
- Enhanced `identifySampleColumns()` with pattern detection
- Added validation and detailed logging
- Detects both ALGA-style and NORF-style naming

#### New Utility Functions
```typescript
/**
 * Categorize a sample as Control or Farm based on naming convention
 * Handles multiple patterns:
 * - ALGA style: contains _C_ or _F_
 * - NORF style: contains "Control" or "Farm" keywords
 */
export function categorizeSample(sampleName: string): 'control' | 'farm' | 'unknown'

/**
 * Group samples by category (control vs farm)
 */
export function groupSamplesByCategory(samples: string[]): {
  control: string[];
  farm: string[];
  unknown: string[];
}
```

#### Enhanced Logging
- Added naming pattern analysis during parsing
- Shows breakdown of ALGA-style vs NORF-style vs other patterns
- Better diagnostics for debugging

### 2. Updated Stacked Taxonomy Chart (`src/components/pin-data/StackedTaxonomyChart.tsx`)

#### Intelligent Control/Farm Detection
- Replaced hardcoded pattern matching with `categorizeSample()` utility
- Now correctly identifies both naming conventions
- Enhanced logging to show categorization results

**Before:**
```typescript
const hasControlFarmPattern = data.samples.some(s => s.includes('_C_')) &&
                               data.samples.some(s => s.includes('_F_'));
```

**After:**
```typescript
const sampleCategories = data.samples.map(sample => ({
  sample,
  category: categorizeSample(sample)
}));

const hasControlSites = sampleCategories.some(s => s.category === 'control');
const hasFarmSites = sampleCategories.some(s => s.category === 'farm');
const hasControlFarmPattern = hasControlSites && hasFarmSites;
```

## Testing

### Test Files
Created comprehensive test scripts to verify functionality:
1. **test-taxonomy-parsing.js** - Verifies CSV parsing for both file types
2. **test-taxonomy-intelligence.js** - Tests categorization logic

### Test Results

**NORF File Samples:**
```
NORF_Control_1 → control ✅
NORF_Control_2 → control ✅
NORF_Control_3 → control ✅
NORF_Farm_1    → farm ✅
NORF_Farm_2    → farm ✅
NORF_Farm_3    → farm ✅

Control/Farm pattern detected: ✅ YES
```

**ALGA File Samples:**
```
ALGA_C_S  → control ✅
ALGA_C_W  → control ✅
ALGA_C_E  → control ✅
ALGA_F_L  → farm ✅
ALGA_F_M  → farm ✅
ALGA_F_AS → farm ✅

Control/Farm pattern detected: ✅ YES
```

### Build Verification
- ✅ TypeScript compilation successful
- ✅ Next.js build completed successfully
- ✅ No new errors introduced

## Benefits

1. **Flexibility:** Now handles multiple naming conventions automatically
2. **Extensibility:** Easy to add support for new patterns in the future
3. **Robustness:** Better error detection and logging
4. **Maintainability:** Centralized categorization logic
5. **Consistency:** Same logic used across all components

## Files Modified
- `src/lib/edna-taxonomy-processor.ts` - Enhanced parsing and added utilities
- `src/components/pin-data/StackedTaxonomyChart.tsx` - Updated to use intelligent categorization

## Impact
Both NORF and ALGA taxonomy files now work correctly with:
- ✅ Proper sample column identification
- ✅ Correct Control/Farm categorization
- ✅ Visual separator line between groups
- ✅ Accurate chart rendering
- ✅ Complete data aggregation

## Future Enhancements
The new `categorizeSample()` utility can be extended to support additional patterns:
- Other project prefixes (beyond ALGA/NORF)
- Alternative category names (e.g., Reference, Treatment, etc.)
- More complex grouping logic if needed

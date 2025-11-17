# eDNA Meta CSV File Plotting and Visualization Analysis

## Overview
This document maps the complete code flow for parsing, processing, and visualizing eDNA Meta CSV files (_Meta.csv) in the PEBL DataApp.

## 1. File Detection and Parsing

### eDNA Meta File Detection
**Location:** src/lib/edna-utils.ts:122-125

```typescript
export function isEdnaMetaFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return lowerName.includes('edna') && (lowerName.includes('_meta') || lowerName.includes('_metadata'));
}
```

### CSV Parsing - Meta File Header Detection  
**Location:** src/components/pin-data/csvParser.ts:219-266

Special logic for eDNA Meta files:
- Scans first 10 rows for header containing concentration parameters
- Looks for: "eDNA concentration", "18sssu marker concentration", "coilb marker concentration"
- Returns row index when 2+ parameters found

### Date Extraction from Filenames
**Location:** src/lib/edna-utils.ts:18-45

Format: PROJECTNAME_EDNA_ALL_YYMM
- Example: ALGA_EDNA_ALL_2507 → July 2025
- Used when Meta files lack time columns

## 2. Sample Name and Control Handling

### Sample Name Detection
**Location:** src/lib/statistical-utils.ts:293-334

For eDNA Meta files: Prioritizes "Sample Name" column
**Location:** src/components/pin-data/csvParser.ts:365-380

### Negative Control Detection  
**Location:** src/lib/edna-utils.ts:77-114

Function: abbreviateStationLabel()
- Detects: samples with "NEG", "NEGATIVE", "CONTROL" keywords
- Pattern: /\b(NEG|NEGATIVE|CONTROL)\b/i
- Action: Returns NEG samples AS-IS without abbreviation
- Example: "HVS_EXT NEG 1" → "EXT NEG 1"

**IMPORTANT:** NEG samples are NOT filtered out - they display on charts

### Spot-Sample Data Grouping
**Location:** src/lib/statistical-utils.ts:148-287

Function: groupBySampleAndDate()
- Groups by: date + sampleId + parameter
- Calculates: mean, SD, SE, min, Q1, median, Q3, max
- X-axis label format: "DD/MM/YY [SampleID StationID]"

## 3. Bar Chart Generation

### ColumnChartWithErrorBars Component
**Location:** src/components/pin-data/ColumnChartWithErrorBars.tsx

Features:
- Parameter-specific filtering
- Error bar display (only when count > 1 AND SD > 0)
- Color modes: unique (per sample) or single (all same)
- Custom Y-axis ranges per parameter
- Rotated X-axis labels (default -45°)
- Tooltip: mean, SD, count, measurement type

Data transformation:
```typescript
const chartData = parameterData.map((group, index) => ({
  xAxisLabel: `${group.xAxisLabel}_${index}`,
  mean: group.stats.mean,
  sd: group.stats.sd,
  count: group.count,
  errorY: hasError ? [sd, sd] : undefined
}));
```

## 4. Concentration Parameters for eDNA Meta

Expected parameters (src/lib/edna-utils.ts:150-156):
- eDNA Concentration (ng/µL)
- 18SSSU Marker Concentration (ng/µL)
- COILB Marker Concentration (ng/µL)

Default visibility (src/components/pin-data/PinChartDisplaySpotSample.tsx):
- Shows first 2 parameters by default
- Can customize in styling rules

## 5. Special File Type Processing

### Credibility Files (_Cred.csv)
**Location:** src/lib/edna-cred-processor.ts

Processing:
1. Find species and GBIF columns
2. Normalize credibility: "low"/"moderate"/"high"
3. Normalize GBIF: "true"/"false"/"yes"/"no"/"1"/"0"
4. Aggregate by credibility + GBIF status
5. Count unique species

Output: StackedCredibilityChart
- 3 credibility levels on X-axis
- Stacked bars: GBIF Verified (dark blue) / Unverified (light blue)

### Taxonomy Files (_taxo.csv)
**Location:** src/lib/edna-taxonomy-processor.ts

Sample categorization:
```typescript
export function categorizeSample(sampleName: string): 'control' | 'farm' | 'unknown' {
  const lower = sampleName.toLowerCase();
  if (lower.includes('_c_') || lower.includes('control')) return 'control';
  if (lower.includes('_f_') || lower.includes('farm')) return 'farm';
  return 'unknown';
}
```

Output: StackedTaxonomyChart
- Percentage stacked bars per sample
- Sorted by phylum abundance

## 6. Complete Data Flow Example

Input: NORF_EDNA_ALL_2507_Meta.csv
```
Sample Name,eDNA Concentration (ng/µL),18SSSU Marker Concentration (ng/µL)
Control_North,45.2,12.3
EXT NEG 1,0.5,0.1
Farm_South,78.5,23.4
```

Processing:
1. isEdnaMetaFile() → true
2. detectEdnaMetaHeaderRow() → finds concentration columns
3. extractEdnaDate() → 2025-07-01
4. Sample column: "Sample Name" detected
5. groupBySampleAndDate() → groups by date+sample+parameter
6. abbreviateStationLabel() → "EXT NEG 1" kept intact

Output: 3 Bar Charts (one per parameter)
- X-axis: "01/07/25 [Control_North]", "01/07/25 [EXT NEG 1]", "01/07/25 [Farm_South]"
- Y-axis: ng/µL
- NEG sample shown with full label
- Error bars if multiple measurements

## 7. Key Source Files

| File | Purpose |
|------|---------|
| csvParser.ts | CSV parsing, eDNA header detection |
| edna-utils.ts | File detection, date extraction, control handling |
| statistical-utils.ts | Sample grouping, statistics |
| edna-cred-processor.ts | Credibility file processing |
| edna-taxonomy-processor.ts | Taxonomy file processing |
| PinChartDisplaySpotSample.tsx | Spot-sample display control |
| ColumnChartWithErrorBars.tsx | Bar chart with error bars |
| StackedCredibilityChart.tsx | Credibility stacked bars |
| StackedTaxonomyChart.tsx | Taxonomy stacked percentage bars |


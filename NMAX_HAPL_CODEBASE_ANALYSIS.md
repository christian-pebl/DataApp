# NMAX and HAPL File Handling - Codebase Analysis

## Overview
This document describes how NMAX and HAPL files are currently detected, parsed, displayed, and managed in the DataApp codebase. These are haplotype data files used for biodiversity analysis in eDNA research.

---

## 1. FILE TYPE DETECTION

### Detection Mechanism
- **Location**: src/components/pin-data/PinPlotInstance.tsx (lines 123-124)
- **Method**: Filename pattern matching for "_hapl" suffix (case-insensitive)

```typescript
const isHaplFile = csvFiles.length > 0 && csvFiles[0].name.toLowerCase().includes('hapl');
```

### File Type Naming
- **HAPL files**: Contain "_hapl" or "_HAPL" in filename (e.g., NORF_EDNAS_ALL_2507_Hapl.csv)
- **NMAX files**: No explicit detection yet (potential TODO)
- Structure similar to HAPL but may contain different metadata
- Currently treated same as HAPL files if they contain "hapl" in name

### File Type Enum
- **Location**: src/components/pin-data/csvParser.ts (line 35)
```typescript
export type FileType = 'GP' | 'FPOD' | 'Subcam' | 'Hapl';
```

---

## 2. FILE PARSING

### Main Parser Function
- **Function**: parseHaplotypeCsv(file: File)
- **Location**: src/components/pin-data/csvParser.ts (lines 935-1079)
- **Input**: File object (JavaScript File API)
- **Output**: HaplotypeParseResult interface

### Data Structures

#### HaplotypeParseResult (Output)
```typescript
interface HaplotypeParseResult {
  species: string[];
  sites: string[];
  data: HaplotypeCellData[];
  errors: string[];
  summary: {
    totalSpecies: number;
    totalSites: number;
    totalCells: number;
  };
}
```

#### HaplotypeCellData
```typescript
interface HaplotypeCellData {
  species: string;
  site: string;
  count: number;
  metadata: HaplotypeMetadata;
}
```

#### HaplotypeMetadata
```typescript
interface HaplotypeMetadata {
  credibility: 'HIGH' | 'MODERATE' | 'LOW' | string;
  phylum: string;
  isInvasive: boolean;
  invasiveSpeciesName: string | null;
  redListStatus: string;
}
```

### Parsing Algorithm

#### Column Classification (lines 967-999)
1. **Metadata Columns** (not site data):
   - score → credibility level
   - phylum → taxonomic phylum
   - nns (Non-Native Species) → invasive species indicator
   - redlist_status → conservation status

2. **Taxonomy Columns** (metadata, not sites):
   - kingdom, phylum, class, order, family, genus, species, date, common

3. **Site Columns** (contain haplotype counts):
   - Any column that doesn't match metadata or taxonomy patterns

#### Data Extraction (lines 1005-1065)
For each data row:
  1. Extract species name (from species column or first column)
  2. Extract metadata (credibility, phylum, invasive status, red list)
  3. For each site column:
     - Create HaplotypeCellData with species, site, count, metadata

#### Species Sorting
- **Location**: Line 1072
- **Order**: Alphabetical (A-Z)
```typescript
result.species.sort((a, b) => a.localeCompare(b));
```

---

## 3. DATA VISUALIZATION

### Haplotype Heatmap Component
- **Location**: src/components/pin-data/HaplotypeHeatmap.tsx
- **Props**: Receives HaplotypeParseResult as haplotypeData
- **Size**: 670 lines

### Display Modes

#### 1. Heatmap View (Main)
- SVG-based visualization
- Species (rows) x Sites (columns) grid
- Color-coded cells based on haplotype count
- **Color Scale**: Purple gradient (#e9d5ff to #6b21a8)

#### 2. Rarefaction Curve View
- **Component**: RarefactionChart.tsx
- Shows species accumulation curve
- Default: Michaelis-Menten curve fit

### Style Rules
- **File**: src/components/pin-data/StylingRulesDialog.tsx
- **Applicable to**: Files matching suffix pattern (e.g., "_hapl.csv")
- **Stored Properties**:
  - heatmapCellWidth
  - heatmapRowHeight

---

## 4. INTEGRATION INTO STACKED PLOT MODE

### Parent Component: PinMarineDeviceData
- **Location**: src/components/pin-data/PinMarineDeviceData.tsx
- **Manages**: Multiple plots in stacked view
- **Plot Types**: 'device' | 'marine-meteo'

### Adding Plots to Stack

#### Workflow: Adding a HAPL File as Plot
1. User clicks "Add Plot" button
2. FileSelectionDialog opens
3. User selects HAPL file
4. Dialog calls onFileSelected(selectedFile)
5. Parent handler calls addPlot('device', [file], {...})
6. PinPlotInstance component created with files prop
7. PinPlotInstance.processCSVFiles() detects "hapl" in filename
8. Calls parseHaplotypeCsv(file)
9. setHaplotypeData(haplotypeResult) updates state
10. Renders HaplotypeHeatmap component

---

## 5. RENDERING PIPELINE

### Component Hierarchy

PinMarineDeviceData
├─ plots.map(plot => {
│   if (plot.type === 'device') {
│     return <PinPlotInstance plot={plot} />
│   }
│ })
│
└─ PinPlotInstance
   ├─ processCSVFiles()
   │  └─ if (isHaplFile) {
   │       parseHaplotypeCsv(file)
   │       setHaplotypeData()
   │     }
   │
   └─ Conditional render:
      if (haplotypeData) {
        return <PinChartDisplay haplotypeData={haplotypeData} />
      } else {
        return <PinChartDisplay data={parseResult.data} />
      }

---

## 6. SPECIES NAME HANDLING

### Storage Location
- **Array**: HaplotypeParseResult.species
- **Type**: string[]
- **Order**: Alphabetically sorted

### Display in UI
- **Species as Rows** in heatmap visualization
- **Y-axis labels**: Full species names (truncated if > 35 chars)
- **Tooltip on hover**: Full species name displayed

### Metadata per Species
- Stored in HaplotypeCellData.metadata for each site
- Contains: credibility, phylum, invasive status, red list status

---

## 7. KEY FILES REFERENCE

| File | Lines | Purpose |
|------|-------|---------|
| csvParser.ts | 935-1079 | parseHaplotypeCsv() function |
| csvParser.ts | 559-579 | parseCSVLine() utility |
| HaplotypeHeatmap.tsx | 1-670 | Main heatmap visualization |
| PinPlotInstance.tsx | 123-129 | HAPL detection logic |
| PinChartDisplay.tsx | 200+ | Display mode selection |
| PinMarineDeviceData.tsx | 143+ | Plot stack management |
| FileSelectionDialog.tsx | 1-400+ | File selection UI |
| RarefactionChart.tsx | - | Species accumulation visualization |

---

## 8. DATA FLOW

CSV File (HAPL)
    ↓
PinPlotInstance.processCSVFiles()
    ↓ (detect "hapl" in filename)
parseHaplotypeCsv(file)
    ↓
HaplotypeParseResult
    ↓
PinChartDisplay (receives haplotypeData)
    ↓
HaplotypeHeatmap
    ↓
Renders SVG with species names, sites, color-coded cells

---

## 9. LIMITATIONS

### NMAX Files
1. No explicit detection - treated same as HAPL
2. No NMAX-specific structure handling
3. Need to add proper NMAX file detection

### Multi-File Operations
1. No haplotype merging - only single file per plot
2. No cross-plot species aggregation

### Species Name Management
1. No species name standardization
2. No duplicate/synonym handling
3. Case sensitive


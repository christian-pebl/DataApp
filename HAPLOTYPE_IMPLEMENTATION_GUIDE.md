# Haplotype (_hapl) File Processing Implementation Guide

## 1. FILE DETECTION

**Location:** src/components/pin-data/PinPlotInstance.tsx (Line 117)
```javascript
const isHaplFile = csvFiles.length > 0 && csvFiles[0].name.toLowerCase().includes('hapl');
```

Also in csvParser.ts (Line 292):
- Detects via: fileName.toLowerCase().includes('hapl')
- Enhanced debugging with 🧬 HAPL_DEBUG logs

---

## 2. PARSING

**Function:** parseHaplotypeCsv() in csvParser.ts (Lines 956-1100)

**Data Structures:**
- HaplotypeParseResult: species[], sites[], data[], errors, summary
- HaplotypeCellData: species, site, count, metadata
- HaplotypeMetadata: credibility, phylum, isInvasive, invasiveSpeciesName, redListStatus

**Parser Logic:**
- Detects metadata columns: score, phylum, nns, redlist_status
- Detects taxonomy columns: kingdom, phylum, class, order, family, genus, species
- All other columns = site columns (haplotype counts)
- Species sorted alphabetically

---

## 3. DISPLAY COMPONENT

**File:** HaplotypeHeatmap.tsx (Lines 1-555)

**Features:**
- Interactive heatmap: species (rows) x sites (columns)
- Colors: light purple (0) to dark purple (max)
- Credibility filters (High/Moderate/Low)
- Hide empty rows toggle
- Red List status column toggle
- Cell width slider (5-150px, default 30)
- Cell height slider (10-100px, default 20)
- Save as style rule button

**Tooltips show:**
- Species name, site, haplotype count
- Credibility, phylum, Red List status
- Invasive species name

---

## 4. PINCHART DISPLAY INTEGRATION

**File:** PinChartDisplay.tsx

**Detection:** Lines 413-422
```javascript
const isHaplotypeFile = useMemo(() => {
  const hasHaploInName = fileName?.toLowerCase().includes('hapl');
  return hasHaploInName;
}, [fileName]);
```

**State:** Lines 445-452
```javascript
const [showHaplotypeHeatmap, setShowHaplotypeHeatmap] = useState(
  isHaplotypeFile && !!haplotypeData
);
```

**Toolbar Toggle:** Lines 2449-2461
- Switch between Table and Heatmap view
- Icons: BarChart3 (table) + Grid3x3 (heatmap)

**Settings Button:** Lines 2463-2488
- Gear icon opens StylingRulesDialog
- Only visible in heatmap mode
- Saves to _Hapl.csv rule

**Rendering:** Lines 2803-2810
```javascript
showHaplotypeHeatmap && isHaplotypeFile && haplotypeData ? (
  <HaplotypeHeatmap haplotypeData={haplotypeData} {...props} />
)
```

---

## 5. STYLING RULES

**File:** StylingRulesDialog.tsx

**Properties:** Lines 39-40
```javascript
heatmapRowHeight?: number;    // default 35px
heatmapCellWidth?: number;    // default 85px
```

**Rule Suffix:** _Hapl.csv
**Description:** Haplotype heatmap styling

---

## 6. DATA FLOW

CSV Upload (_hapl.csv)
  -> PinPlotInstance.processCSVFiles()
  -> csvParser.parseHaplotypeCsv()
  -> HaplotypeParseResult
  -> PinChartDisplay (haplotypeData prop)
  -> showHaplotypeHeatmap toggle
  -> HaplotypeHeatmap Component
  -> Interactive visualization with filters/sliders

---

## 7. KEY FILES & LINE NUMBERS

File Detection: PinPlotInstance.tsx:117
Parsing: csvParser.ts:956-1100
Data Types: csvParser.ts:38-63
Component: HaplotypeHeatmap.tsx:1-555
Integration: PinChartDisplay.tsx:25,76,413-422,445-452,2449-2488,2803-2810
Styling: StylingRulesDialog.tsx:39-40

---

## 8. PLOT MODE SELECTOR

CURRENTLY MISSING - Opportunity for enhancement:

The heatmap currently has only ONE display mode (static heatmap).

Potential modes to add:
1. Stacked bar charts (by site or by credibility)
2. Bubble plot (size/color = count)
3. Scatter plot
4. Network visualization

Would require:
- New state: showPlotMode / plotMode
- Mode selector buttons in toolbar (above existing Table/Heatmap toggle)
- Separate render functions for each mode
- Update StylingRulesDialog with mode-specific properties

---

## 9. SETTINGS BUTTON IMPLEMENTATION

Current Settings Button: PinChartDisplay.tsx:2474-2486
- Opens StylingRulesDialog
- Saves cell width/height to _Hapl.csv rule
- Button code:
  <Button variant="ghost" size="icon" className="h-7 w-7"
          title="Haplotype heatmap settings"
          onClick={() => setShowStylingRules(true)}>
    <Settings className="h-4 w-4" />
  </Button>

Enhancements possible:
- Color scheme selector
- Legend visibility toggle
- Export options
- Tooltip configuration

---

## 10. CSV FORMAT

Expected columns:
- Species (identifier)
- Score (credibility level)
- Phylum (taxonomy)
- NNS (invasive species name)
- RedList_Status (conservation status)
- Site columns (haplotype counts - numeric)

Example:
Species,Score,Phylum,NNS,RedList_Status,Site1,Site2,Site3
SpeciesA,HIGH,Chordata,NA,Vulnerable,5,3,0
SpeciesB,MODERATE,Arthropoda,InvasiveName,Not Evaluated,2,4,1

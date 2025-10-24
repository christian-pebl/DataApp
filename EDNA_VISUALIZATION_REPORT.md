# eDNA Visualization Report
## PEBL Project - Algapelego Marine eDNA Analysis

**Date Generated:** October 24, 2025
**Project:** 25040_01 - PEBL
**Data Source:** ALGA_EDNA_ALL_2507 Dataset

---

## Executive Summary

Successfully generated two complementary visualizations for eDNA analysis:

1. **Taxonomy Stacked Bar Chart** - Community composition by phylum
2. **Haplotype Bubble Chart** - Genetic diversity and detection credibility

Both visualizations compare **Control Sites** (C_S, C_W, C_E) vs **Farm Sites** (F_L, F_M, F_AS).

---

## Visualization 1: Taxonomy Stacked Bar Chart

### Purpose
Visualize community composition differences between Control and Farm sites at the phylum level.

### Data Processed
- **Total Records:** 107 valid taxonomic entries
- **Phyla Detected:** 18 unique phyla
- **Samples:** 6 locations (3 Control, 3 Farm)

### Taxa Richness by Sample
| Sample | Total Taxa | Category |
|--------|------------|----------|
| ALGA_C_S | 13 | Control |
| ALGA_C_W | 12 | Control |
| ALGA_C_E | 12 | Control |
| ALGA_F_L | 12 | Farm |
| ALGA_F_M | 26 | Farm |
| ALGA_F_AS | 6 | Farm |

### Key Observations
- **Farm site ALGA_F_M** shows notably higher taxa richness (26 taxa)
- **Farm site ALGA_F_AS** shows lowest taxa richness (6 taxa)
- Control sites show consistent richness (12-13 taxa)

### Phyla Detected
18 unique phyla across all samples:
- Annelida, Arthropoda, Bigyra, Bryozoa, Cercozoa
- Chlorophyta, Chordata, Ciliophora, Cnidaria, Echinodermata
- Haptophyta, Mollusca, Myzozoa, Nematoda, Nemertea
- Ochrophyta, Platyhelminthes, Porifera

### Visualization Features
- **Stacked bars** showing percentage composition per site
- **Color-coded phyla** for easy identification
- **Hover tooltips** displaying count and percentage
- **Visual separator** between Control and Farm sites
- **Taxa richness labels** (n=X) above each bar

### Output File
`output/taxonomy-composition.html` (4.4 MB, interactive)

---

## Visualization 2: Haplotype Bubble Chart

### Purpose
Display genetic diversity (haplotype counts), detection credibility, and biosecurity concerns across sampling sites.

### Data Processed
- **Species Detected:** 20 species with valid detections
- **Total Data Points:** 45 species×sample combinations
- **Invasive Species Flagged:** 0
- **Threatened Species Flagged:** 0

### Credibility Distribution
Detection confidence levels across all data points:
- **HIGH:** 10 detections (22%)
- **MODERATE:** 26 detections (58%)
- **LOW:** 9 detections (20%)

### Genetic Diversity Highlights
Species ranked by total haplotype counts (genetic variants detected):
- Multiple species showing 2-7 unique haplotypes
- Higher haplotype counts suggest:
  - Diverse populations
  - Multiple source populations
  - Potential cryptic species complexes

### Visualization Features
- **Bubble size** = number of unique haplotypes (genetic variants)
- **Bubble color** = detection credibility (GREEN=high, YELLOW=moderate, RED=low)
- **Special markers:**
  - Red border = invasive/non-native species (none detected)
  - Orange border = threatened species (none detected)
- **Hover tooltips** with complete species information
- **Italicized species names** on y-axis (taxonomic convention)
- **Ranked display** by total genetic diversity

### Output Files
- `output/haplotype-diversity.html` (4.4 MB, interactive)
- `output/haplotype-data-summary.csv` (3 KB, data export)

---

## Key Findings

### Community Composition (Taxonomy)
1. **Variability in Farm Sites:**
   - ALGA_F_M shows exceptionally high taxa richness
   - ALGA_F_AS shows low taxa richness
   - Suggests heterogeneous farm site conditions

2. **Consistency in Control Sites:**
   - Similar richness across all three control sites (12-13 taxa)
   - Suggests stable reference conditions

### Genetic Diversity (Haplotypes)
1. **Detection Quality:**
   - 22% high-confidence detections
   - 58% moderate-confidence detections
   - 20% low-confidence detections (use with caution)

2. **No Biosecurity Concerns:**
   - No invasive species detected
   - No threatened species detected in this subset

3. **Genetic Diversity Patterns:**
   - Multiple species show 2+ haplotypes
   - Indicates healthy genetic diversity or multiple populations

---

## Technical Details

### Software Stack
- **Python 3.13**
- **pandas** (data processing)
- **plotly** (interactive visualizations)
- **Input Format:** CSV files from eDNA metabarcoding

### Data Sources
- `ALGA_EDNA_ALL_2507_Taxo.csv` - Full taxonomy dataset
- `ALGA_EDNA_ALL_2507_Hapl.csv` - Haplotype dataset with credibility scores

### Quality Control
- Empty rows filtered out
- NA values handled appropriately
- Validation checks for data integrity
- Credibility scores preserved from GBIF Bayesian analysis

---

## How to Use the Visualizations

### Interactive Features (HTML files)
1. **Hover** - View detailed information for any element
2. **Legend Click** - Toggle phyla/credibility levels on/off
3. **Zoom/Pan** - Explore specific regions
4. **Download** - Use built-in export button for PNG/SVG

### Exporting High-Quality Images
1. Open HTML file in web browser
2. Click camera icon (top-right) for PNG export
3. Or use browser print-to-PDF for publication-quality output

### Data Export (CSV file)
- `haplotype-data-summary.csv` contains processed long-format data
- Importable into R, Excel, or other analysis tools
- Columns: species, sample, haplotype_count, credibility, phylum, etc.

---

## Interpretation Guidelines

### Taxonomy Data (Presence/Absence)
- Values are **binary (0 or 1)** per taxon per sample
- Best for: community composition, biodiversity indices
- Includes organisms identified to any taxonomic level (even partial IDs)

### Haplotype Data (Genetic Variants)
- Values are **counts (0-7+)** of unique genetic sequences
- Best for: genetic diversity, population structure, cryptic species
- Only includes organisms confidently identified to genus/species level

### Credibility Scores
- **HIGH (Green):** Reliable, suitable for management decisions
- **MODERATE (Yellow):** Reasonable confidence, verify if critical
- **LOW (Red):** Caution - potential false positives, require validation

---

## Recommendations

### For Further Analysis
1. **Statistical Testing:**
   - PERMANOVA to test Control vs Farm differences
   - Shannon/Simpson diversity indices
   - Beta diversity analysis

2. **Temporal Analysis:**
   - If multi-temporal data available, track changes over time
   - Seasonal patterns in community composition

3. **Species of Interest:**
   - Focus on HIGH credibility detections for management
   - Investigate species with high haplotype counts (potential species complexes)

### For Reporting
1. **Combine Both Visualizations:**
   - Taxonomy shows "what's there" (broad community)
   - Haplotypes show "genetic detail" (population-level insights)

2. **Export Considerations:**
   - Use HTML for interactive presentations
   - Export PNG from browser for static reports/publications
   - Include both phylum-level and species-level findings

---

## Files Generated

| Filename | Size | Format | Purpose |
|----------|------|--------|---------|
| `taxonomy-composition.html` | 4.4 MB | Interactive HTML | Phylum composition visualization |
| `haplotype-diversity.html` | 4.4 MB | Interactive HTML | Genetic diversity visualization |
| `haplotype-data-summary.csv` | 3 KB | CSV | Processed haplotype data export |

**Location:** `C:\Users\Christian Abulhawa\DataApp\output\`

---

## Contact & Citation

**Data Source:** PEBL Project (25040_01)
**Analysis Date:** October 23-24, 2025
**Generated By:** Automated eDNA visualization pipeline

**Recommended Citation:**
> "Genetic diversity analysis performed using eDNA metabarcoding data. Haplotype counts represent unique amplicon sequence variants (ASVs) detected per taxon. Credibility scores derived from Bayesian analysis using GBIF occurrence data."

---

## Appendix: Methodology

### Taxonomy Aggregation
1. Filter valid records (non-empty phylum)
2. Group by phylum, sum presence/absence per sample
3. Convert to percentages for relative abundance
4. Display as stacked bars (100% scale)

### Haplotype Selection
1. Calculate total haplotypes across all samples
2. Rank species by genetic diversity
3. Select top 20 species
4. Always include invasive/threatened species (if present)
5. Transform to long format for bubble plotting

### Visualization Design Principles
- **Academic standards:** Italicized species names, proper taxonomic hierarchy
- **Color accessibility:** Distinct colors for phyla and credibility levels
- **Interactive exploration:** Hover tooltips, legend toggles, zoom/pan
- **Publication-ready:** High-resolution export capability via browser

---

**End of Report**

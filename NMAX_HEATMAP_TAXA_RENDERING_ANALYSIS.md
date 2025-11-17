# NMAX Heatmap Taxa Rendering Analysis

## Overview
This document provides a comprehensive analysis of how the NMAX heatmap component (HaplotypeHeatmap.tsx) currently displays taxa entries.

## 1. Component Architecture

### Main Component: HaplotypeHeatmap.tsx
Location: src/components/pin-data/HaplotypeHeatmap.tsx

Key Props (lines 22-36):
- haplotypeData: HaplotypeParseResult
- containerHeight: number
- rowHeight?: number (default: 20px)
- cellWidth?: number (default: 30px)

View Modes (line 42):
- 'heatmap' - Main heatmap display with taxa as Y-axis labels
- 'rarefaction' - Species accumulation curve visualization
- 'tree' - Hierarchical tree view of taxa (alternative rendering)

Sort Modes (line 43):
- 'hierarchical' (DEFAULT) - Groups taxa by taxonomic hierarchy with indentation
- 'alphabetical' - Simple alphabetical A-Z sorting

## 2. Data Structures for Taxonomic Information

### Haplotype Metadata (csvParser.ts, lines 39-61)
Contains:
- credibility: HIGH, MODERATE, or LOW
- phylum: Taxonomic phylum
- fullHierarchy: Optional object with kingdom, phylum, class, order, family, genus, species
- taxonomySource: 'worms' or 'gbif'
- taxonomyConfidence: 'high', 'medium', or 'low'
- taxonomyRank: Display abbreviation (sp./gen./fam./ord./class./phyl.)

### Tree Node Structure (taxonomic-tree-builder.ts, lines 9-18)
Interface TreeNode:
- name: string (taxon name)
- rank: 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species' | 'unknown'
- children: TreeNode[]
- speciesCount: number (unique species under this node)
- siteOccurrences: Map<string, number> (for species: site -> haplotype count)
- isLeaf: boolean (true if species node)
- confidence and source (taxonomy metadata)

### Flattened Taxon (taxonomic-tree-builder.ts, lines 182-188)
Interface FlattenedTaxon:
- name: string
- rank: TreeNode['rank']
- indentLevel: number (0-6, where 0=kingdom, 6=species)
- path: string[] (full lineage path)
- node: TreeNode (reference to original tree node)

## 3. How Taxonomic Data is Built and Sorted

### Step 1: Build Taxonomic Tree (lines 33-141 in taxonomic-tree-builder.ts)

Function: buildTaxonomicTree(data: HaplotypeCellData[])

Process:
1. Creates root node named 'Life'
2. Groups data by species to extract unique species with full hierarchy
3. For each species, creates path: Life -> Kingdom -> Phylum -> Class -> Order -> Family -> Genus -> Species
4. Inserts each species into tree, creating parent nodes as needed
5. SORTS children ALPHABETICALLY at each level (line 134):
   node.children.sort((a, b) => a.name.localeCompare(b.name));
6. Recursively sorts entire tree in depth-first order

### Step 2: Flatten Tree for Heatmap Display (lines 194-220)

Function: flattenTreeForHeatmap(tree: TreeNode): FlattenedTaxon[]

Process:
1. Performs depth-first traversal of tree
2. Skips artificial 'Life' root node
3. Creates FlattenedTaxon entry for each node with indentLevel

## 4. Species/Taxa Ordering and Filtering

### Hierarchical Sort Mode (lines 253-264 in HaplotypeHeatmap.tsx)

Code snippet:
if (sortMode === 'hierarchical') {
  sortedTaxa = flattenedTaxa.filter(taxon => finalFilteredSet.has(taxon.name));
  sortedSpecies = sortedTaxa.map(t => t.name);
} else {
  sortedSpecies = Array.from(finalFilteredSet).sort((a, b) => a.localeCompare(b));
}

Current behavior:
- Hierarchical: Uses depth-first tree traversal order (preserves taxonomic grouping)
- Alphabetical: Simple string comparison (A-Z)

### Filtering Pipeline (lines 221-276)

1. Credibility Filter (lines 224-231): Remove species not matching HIGH/MODERATE/LOW filters
2. Empty Row Filter (lines 243-251): Optionally hide species with all-zero counts
3. Final Ordering (lines 253-264): Sort remaining species by chosen mode

## 5. Visual Rendering of Taxa Labels

### Y-Axis Taxa Rendering (lines 756-790 in HaplotypeHeatmap.tsx)

SVG rendering of taxon names on left side of heatmap:

Key logic:
const indentPx = taxonInfo ? taxonInfo.indentLevel * 20 : 0;  // 20px per level
const rankColor = taxonInfo ? getRankColor(taxonInfo.rank) : '#4b5563';

Visual properties:
- X-position: Indented by indentLevel * 20px per level
- Y-position: Centered on each row
- Color: Based on taxonomic rank (getRankColor function)
- Font size: yAxisLabelFontSize (default: 12px)
- Tooltip: Shows rank on hover

## 6. Rank Color Mapping

Function: getRankColor(rank: TreeNode['rank']): string
Location: taxonomic-tree-builder.ts, lines 146-159

Colors:
- kingdom: #dc2626 (red-600)
- phylum: #ea580c (orange-600)
- class: #d97706 (amber-600)
- order: #ca8a04 (yellow-600)
- family: #65a30d (lime-600)
- genus: #16a34a (green-600)
- species: #059669 (emerald-600)
- unknown: #6b7280 (gray-500)

Progression: Red (kingdom) -> Orange -> Amber -> Yellow -> Lime -> Green -> Emerald (species)

## 7. Dynamic Column Width Calculation

Location: lines 278-290 in HaplotypeHeatmap.tsx

In hierarchical mode:
- maxIndent = maximum indentLevel in filteredTaxa
- maxNameLength = longest species name
- calculatedWidth = (maxIndent * 20) + (maxNameLength * 7) + 40
- Final width = Math.max(250, Math.min(calculatedWidth, 500))

In alphabetical mode:
- Fixed width = 200px

## 8. Key Code Locations Reference

Component structure            | HaplotypeHeatmap.tsx             | 45-52
View/Sort mode state          | HaplotypeHeatmap.tsx             | 68-71
Tree building                 | taxonomic-tree-builder.ts        | 33-141
Tree flattening               | taxonomic-tree-builder.ts        | 194-220
Processing & filtering        | HaplotypeHeatmap.tsx             | 221-276
Column width calc             | HaplotypeHeatmap.tsx             | 278-290
Y-axis rendering              | HaplotypeHeatmap.tsx             | 756-790
Rank colors                   | taxonomic-tree-builder.ts        | 146-159
Tree view rendering           | TaxonomicTreeView.tsx            | 42-128
Metadata structure            | csvParser.ts                     | 39-61

## 9. Summary: Sorting & Indentation Rules

Current Rules (lines 253-264):
1. Filter species by credibility and empty-row settings
2. If hierarchical mode:
   - Use flattenedTaxa order (preserves tree depth-first traversal)
   - Within each rank, taxa are already sorted alphabetically from buildTaxonomicTree
3. If alphabetical mode:
   - Sort all visible species names A-Z using localeCompare

Indentation Rules (line 764):
- indentPx = taxonInfo.indentLevel * 20 pixels
- indentLevel comes from FlattenedTaxon calculated during tree flattening
- Values range from 0 (kingdom) to 6 (species)

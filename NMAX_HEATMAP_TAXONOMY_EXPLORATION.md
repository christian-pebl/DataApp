# NMAX HEATMAP AND TAXONOMIC TREE EXPLORATION

## SUMMARY

The nmax heatmap implementation uses a two-tier hierarchical system:

1. TREENODE - Full tree with parent-child relationships
   - File: src/lib/taxonomic-tree-builder.ts
   - Properties: name, rank, children[], isLeaf, csvEntry, speciesCount
   - Parent-child: Direct references via children[] array

2. FLATTENEDTAXON - Linear display format for heatmap
   - File: src/lib/taxonomic-tree-builder.ts  
   - Properties: name, rank, indentLevel, path[], node
   - Parent-child: Via path array and indentLevel matching

## KEY FILES

1. HaplotypeHeatmap.tsx (src/components/pin-data/)
   - Main heatmap component
   - Lines 242-311: Data processing pipeline
   - Lines 289-294: Hierarchical sorting (filters to leaf nodes)
   - Lines 809-871: Parent-child connection lines
   - Lines 873-946: Y-axis rendering with rank badges
   - Uses FlattenedTaxon[] for rendering

2. TaxonomicTreeView.tsx (src/components/pin-data/)
   - Interactive tree visualization
   - Lines 23-171: TreeNodeComponent rendering
   - Node styling based on csvEntry and children
   - Tracks relationships via node.children[]

3. taxonomic-tree-builder.ts (src/lib/)
   - buildTaxonomicTree(): Creates TreeNode hierarchy
   - flattenTreeForHeatmap(): Converts to FlattenedTaxon[]
   - Lines 312-324: Rank-to-indent mapping (CRITICAL)
   
4. csvParser.ts (src/components/pin-data/)
   - HaplotypeCellData: Basic CSV structure
   - HaplotypeMetadata: Taxonomy enrichment container
   - fullHierarchy: Complete taxonomy from WoRMS/GBIF

5. taxonomy-service.ts (src/lib/)
   - lookupSpeciesBatch(): Fetches from WoRMS/GBIF APIs
   - TaxonomyResult and TaxonomicHierarchy interfaces

## DATA STRUCTURES

### HaplotypeCellData
- species: string (CSV species name)
- site: string (sample location)
- count: number (haplotype count)
- metadata: HaplotypeMetadata

### HaplotypeMetadata
CSV fields: credibility, phylum, isInvasive, redListStatus
API fields: taxonomySource, taxonId, commonNames, fullHierarchy, taxonomyConfidence

### TreeNode
- name: Cleaned species name (no rank annotations)
- originalName?: CSV name with rank annotations
- rank: kingdom | phylum | class | order | family | genus | species | unknown
- children: TreeNode[] (DIRECT CHILDREN ONLY)
- speciesCount: Total species recursively
- isLeaf: true if actual CSV entry or no children
- csvEntry: true if exists in CSV
- siteOccurrences?: Map<site, count> (leaf nodes only)
- confidence?: high | medium | low (leaf nodes)
- source?: worms | gbif | unknown (leaf nodes)

### FlattenedTaxon
- name: String (same as TreeNode.name)
- rank: Taxonomic rank
- indentLevel: 0-6 RANK-BASED (NOT tree depth!)
- path: String[] (full lineage for parent tracking)
- node: TreeNode (reference back)

Indent mapping (lines 312-324 in taxonomic-tree-builder.ts):
- kingdom = 0
- phylum = 0  
- class = 2
- order = 3
- family = 4
- genus = 5
- species = 6

## DATA FLOW

1. CSV File
   → csvParser.parseHaplotypeCSV()
   → HaplotypeCellData[] (basic metadata)

2. Component Mount
   → taxonomy-service.lookupSpeciesBatch()
   → WoRMS/GBIF APIs
   → species_taxonomy table (Supabase)
   → HaplotypeMetadata enriched with fullHierarchy
   → setEnrichedData()

3. Enriched Data
   → buildTaxonomicTree(enrichedData.data)
   → TreeNode (full hierarchy)
   → flattenTreeForHeatmap(tree)
   → FlattenedTaxon[] (linear display)

4. Heatmap Rendering
   → Filter by credibility, hide empty rows
   → Sort: hierarchical (use flattenedTaxa) or alphabetical
   → filteredSpecies[] (Y-axis order)
   → filteredTaxa[] (with indent info for hierarchical)

## PARENT-CHILD TRACKING

### In TreeNode
- node.children[]: Direct children
- node.name + node.rank: Unique identifier
- Example: Acartia (genus, rank) has child Acartia tonsa (species, rank)

### In FlattenedTaxon
- path[]: Complete lineage
  Example: ["Animalia", "Chordata", "Copepoda", "Acartia", "Acartia tonsa"]
- To find children of a taxon:
  if (child.indentLevel === parent.indentLevel + 1 &&
      child.path.includes(parent.name))
  → child is direct child of parent

### In Heatmap (lines 815-825)
```typescript
const children = [];
for (let i = index + 1; i < filteredTaxa.length; i++) {
  if (filteredTaxa[i].indentLevel <= taxon.indentLevel) break;
  if (filteredTaxa[i].indentLevel === taxon.indentLevel + 1 &&
      filteredTaxa[i].path.includes(taxon.name)) {
    children.push(filteredTaxa[i]);
  }
}
```

## HIERARCHICAL SORTING (Lines 289-294)

Only leaf nodes are included in heatmap display:
```typescript
sortedTaxa = flattenedTaxa.filter(taxon => 
  taxon.node.isLeaf && finalFilteredSet.has(taxon.name)
);
```

Parent nodes are rendered with connection lines but not as data rows.

## HEATMAP RENDERING

### Y-Axis Labels (lines 873-946)
For each species:
1. Get taxon info from flattenedTaxa
2. Get rank color: getRankColor(rank)
3. Get rank abbreviation: K/P/C/O/F/G/S
4. Indentation: indentLevel * 20px
5. Render rank badge + species name

### Parent-Child Lines (lines 809-871)
Only drawn in hierarchical mode:
- Skip leaf nodes
- Find children: next indent = current + 1, child path includes parent
- Vertical line from parent
- Horizontal lines to each child

### Cell Width (lines 314-325)
Width = (maxIndent * 20) + (maxNameLength * 7) + 40
Clamped to 250-500px

## TREE VIEW COMPONENT

TreeNodeComponent (TaxonomicTreeView.tsx lines 23-171)

Node styling:
- CSV entry with children: bg-blue-50/50 (prominent)
- CSV entry without children: bg-emerald-50 (clickable)
- Parent-only nodes: opacity-25 (non-interactive)

Elements per node:
1. Expand/Collapse icon (if children)
2. Rank badge (colored K/P/C/O/F/G/S)
3. Node name (originalName or cleaned name)
4. Species count badge (parent nodes)
5. Haplotype count badge (CSV entries)
6. Taxonomy source + confidence dot (CSV entries)

Parent-child relationships:
- node.children[]: Direct children array
- node.isLeaf: Distinguishes entries from parents
- node.csvEntry: Marks CSV entries
- Indentation: level * 20px + 12px for species

## ABSOLUTE FILE PATHS

C:\Users\Christian Abulhawa\DataApp\src\components\pin-data\HaplotypeHeatmap.tsx
C:\Users\Christian Abulhawa\DataApp\src\components\pin-data\TaxonomicTreeView.tsx
C:\Users\Christian Abulhawa\DataApp\src\components\pin-data\csvParser.ts
C:\Users\Christian Abulhawa\DataApp\src\lib\taxonomic-tree-builder.ts
C:\Users\Christian Abulhawa\DataApp\src\lib\taxonomy-service.ts


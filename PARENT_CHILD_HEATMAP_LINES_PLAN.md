# Implementation Plan: Parent-Child Relationship Lines in NMAX Heatmap

## Overview
Add visual indicators (vertical lines) to the NMAX heatmap to show parent-child taxonomic relationships, similar to a file tree view.

### Example:
```
Trispoterus (G)      [heatmap data...]
│
└─ Trispoterus minutus (S)  [heatmap data...]
```

---

## Current State Analysis

### File Locations:
- **Main Component**: `src/components/pin-data/HaplotypeHeatmap.tsx`
- **Tree Builder**: `src/lib/taxonomic-tree-builder.ts`

### Current Behavior (Lines 289-294 in HaplotypeHeatmap.tsx):
```typescript
if (sortMode === 'hierarchical') {
  // Filter to only include leaf nodes (actual CSV entries)
  sortedTaxa = flattenedTaxa.filter(taxon =>
    taxon.node.isLeaf && finalFilteredSet.has(taxon.name)
  );
  sortedSpecies = sortedTaxa.map(t => t.name);
}
```

**Problem**: Only leaf nodes (species) are displayed. Parent nodes (genus, family, etc.) are **filtered out**, so parent-child visual relationships cannot be shown.

### Existing Connection Line Logic (Lines 807-871):
There's already code for drawing connection lines, but:
- **Line 812**: Immediately returns `null` for leaf nodes
- **Line 811**: Comment says "Since we now filter to only leaf nodes, skip line drawing"
- This logic is effectively **disabled** in current implementation

---

## Implementation Plan

### Phase 1: Include Parent Nodes in Display

**File**: `src/components/pin-data/HaplotypeHeatmap.tsx` (lines 289-294)

**Current Code**:
```typescript
if (sortMode === 'hierarchical') {
  sortedTaxa = flattenedTaxa.filter(taxon =>
    taxon.node.isLeaf && finalFilteredSet.has(taxon.name)
  );
  sortedSpecies = sortedTaxa.map(t => t.name);
}
```

**New Logic**:
```typescript
if (sortMode === 'hierarchical') {
  // Step 1: Get all leaf nodes that match filters
  const leafNodes = flattenedTaxa.filter(taxon =>
    taxon.node.isLeaf && finalFilteredSet.has(taxon.name)
  );

  // Step 2: Build set of all ancestors needed
  const neededNodeNames = new Set<string>();
  leafNodes.forEach(leaf => {
    // Add the leaf itself
    neededNodeNames.add(leaf.name);
    // Add all ancestors in the path
    leaf.path.forEach(ancestorName => neededNodeNames.add(ancestorName));
  });

  // Step 3: Filter flattened tree to include both leaves and their ancestors
  sortedTaxa = flattenedTaxa.filter(taxon =>
    neededNodeNames.has(taxon.name)
  );

  sortedSpecies = sortedTaxa.map(t => t.name);

  console.log('[HEATMAP] Hierarchical mode with parents:', {
    leafCount: leafNodes.length,
    totalWithParents: sortedTaxa.length,
    parentCount: sortedTaxa.length - leafNodes.length
  });
}
```

**Why this works**:
- Includes both species (leaf nodes) AND their parent taxonomic levels
- Preserves hierarchical order from depth-first traversal
- Only includes ancestors that are needed (no orphan parents)

---

### Phase 2: Modify Connection Line Rendering

**File**: `src/components/pin-data/HaplotypeHeatmap.tsx` (lines 809-871)

**Current Logic Issues**:
1. Line 812: `if (taxon.node.isLeaf) return null;` - Skips all lines because all displayed taxa were leaves
2. Lines 815-825: Complex logic to find children, but never executed
3. Lines 838-870: Drawing logic exists but is never reached

**New Approach** - Simpler visual indicator:

Replace the entire connection line section (lines 809-871) with:

```typescript
{sortMode === 'hierarchical' && filteredTaxa.map((taxon, index) => {
  // Skip if this is the last item in the list
  if (index >= filteredTaxa.length - 1) return null;

  const nextTaxon = filteredTaxa[index + 1];

  // Draw vertical line if next item is a direct child
  const isDirectChild = (
    nextTaxon.indentLevel === taxon.indentLevel + 1 &&
    nextTaxon.path.includes(taxon.name)
  );

  if (!isDirectChild) return null;

  // Calculate Y positions
  const parentY = (yScale(taxon.name) ?? 0) + yScale.bandwidth() / 2;
  const childY = (yScale(nextTaxon.name) ?? 0) + yScale.bandwidth() / 2;

  // Calculate X position (left edge of child's indent)
  const lineX = (() => {
    let x = -SPECIES_NAME_WIDTH + nextTaxon.indentLevel * 20 - 10;
    if (showRedListColumn) x -= RED_LIST_COLUMN_WIDTH;
    if (showGBIFColumn) x -= GBIF_COLUMN_WIDTH;
    return x;
  })();

  return (
    <line
      key={`parent-child-${taxon.name}-${nextTaxon.name}`}
      x1={lineX}
      y1={parentY + yScale.bandwidth() / 2}
      x2={lineX}
      y2={childY - yScale.bandwidth() / 2}
      stroke="#9ca3af"
      strokeWidth={2}
      strokeDasharray="3,3"
      opacity={0.6}
    />
  );
})}
```

**Visual Style**:
- **Dashed line** (`strokeDasharray="3,3"`) to distinguish from other UI elements
- **Gray color** (`#9ca3af`) to match existing tree styling
- **Semi-transparent** (`opacity={0.6}`) to not overpower data
- **Positioned left of child indent** to create tree-like appearance

**Result**:
```
Genus                 [data cells...]
┊
Species               [data cells...]
```

---

### Phase 3: Handle Parent-Only Rows (No Data Cells)

**File**: `src/components/pin-data/HaplotypeHeatmap.tsx` (around lines 920-980)

**Challenge**: Parent nodes (genus, family) don't have haplotype data, only species do.

**Current cell rendering** (approximate line 940):
```typescript
{yScale.domain().map(speciesName => (
  <g key={`row-${speciesName}`}>
    {sites.map(site => {
      const cell = filteredCells.find(c =>
        c.species === speciesName && c.site === site
      );
      const value = cell?.count ?? 0;
      // ... render cell
    })}
  </g>
))}
```

**New Logic**:
```typescript
{yScale.domain().map(speciesName => {
  // Find taxon info to check if it's a parent node
  const taxonInfo = filteredTaxa.find(t => t.name === speciesName);
  const isParentNode = taxonInfo && !taxonInfo.node.isLeaf;

  return (
    <g key={`row-${speciesName}`}>
      {sites.map(site => {
        // Parent nodes have no data cells, render empty
        if (isParentNode) {
          return (
            <rect
              key={`cell-${speciesName}-${site}`}
              x={xScale(site)}
              y={yScale(speciesName)}
              width={xScale.bandwidth()}
              height={yScale.bandwidth()}
              fill="transparent"
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
          );
        }

        // Leaf nodes render normally with data
        const cell = filteredCells.find(c =>
          c.species === speciesName && c.site === site
        );
        const value = cell?.count ?? 0;
        // ... existing render logic
      })}
    </g>
  );
})}
```

**Result**: Parent rows show empty cells with subtle borders to maintain grid alignment.

---

### Phase 4: Optional Enhancements

#### 4.1: Visual Styling for Parent Rows
Make parent node names **bold** to distinguish from species:

```typescript
{/* Taxa names with rank badges */}
{yScale.domain().map(speciesName => {
  const taxonInfo = sortMode === 'hierarchical'
    ? filteredTaxa.find(t => t.name === speciesName)
    : null;

  const isParentNode = taxonInfo && !taxonInfo.node.isLeaf;

  return (
    <text
      key={`label-${speciesName}`}
      x={textX}
      y={y}
      dy="0.35em"
      textAnchor="start"
      fontSize="14px"
      fontWeight={isParentNode ? "600" : "normal"}
      fontStyle={isParentNode ? "italic" : "normal"}
      fill={isParentNode ? "#374151" : "#1f2937"}
    >
      {speciesName}
    </text>
  );
})}
```

#### 4.2: Collapsible Tree Nodes (Future Feature)
Add ability to collapse/expand parent nodes:
- Click on parent to hide/show children
- Save expanded state in component state
- Useful for large datasets with many species per genus

#### 4.3: Multiple Children Handling
For parents with multiple children, draw continuous vertical line:

```
Genus          [data...]
┊
├─ Species 1   [data...]
┊
└─ Species 2   [data...]
```

This requires more complex logic to detect first/middle/last children.

---

## Testing Strategy

### Test Case 1: Trispoterus Example (from user's screenshot)
**Expected Result**:
```
Trispoterus (G)           [empty cells]
┊
Trispoterus minutus (S)   [data cells with values]
```

### Test Case 2: Multiple Children
**File**: Any _hapl file with genus containing multiple species
**Expected**: Vertical line spans from parent to last child

### Test Case 3: Empty Row Filtering
**Scenario**: Enable "Hide Empty Rows" toggle
**Expected**: If parent has no visible children, parent should also be hidden

### Test Case 4: Alphabetical Mode
**Expected**: No parent nodes, no connection lines (current behavior preserved)

---

## Code Locations Summary

| Phase | File | Lines | Description |
|-------|------|-------|-------------|
| Phase 1 | `HaplotypeHeatmap.tsx` | 289-294 | Include parent nodes in filtering |
| Phase 2 | `HaplotypeHeatmap.tsx` | 809-871 | Draw connection lines |
| Phase 3 | `HaplotypeHeatmap.tsx` | ~920-980 | Handle empty parent cells |
| Phase 4.1 | `HaplotypeHeatmap.tsx` | ~880-910 | Style parent node labels |

---

## Implementation Sequence

1. ✅ **Understand codebase** (DONE)
2. ⏳ **Phase 1**: Modify filtering to include parents
3. ⏳ **Phase 2**: Update connection line rendering
4. ⏳ **Phase 3**: Handle empty cells for parents
5. ⏳ **Test with real data**
6. ⏳ **Phase 4** (optional): Visual enhancements

---

## Potential Issues & Solutions

### Issue 1: Performance with Large Trees
**Problem**: Including all parent nodes may significantly increase rendered rows
**Solution**:
- Only include ancestors of visible leaves
- Phase 1 logic already handles this with `neededNodeNames` set

### Issue 2: Indent Calculation
**Problem**: Parent and child indent levels must align correctly
**Solution**:
- Use existing `indentLevel` from `FlattenedTaxon` (already rank-based)
- Connection line X position calculated from child's indent level

### Issue 3: Y-Scale Domain
**Problem**: Y-scale domain is built from `filteredSpecies` array (line ~400)
**Solution**:
- `filteredSpecies` now includes parent names after Phase 1 changes
- Y-scale will automatically include parent rows

### Issue 4: Color Scale for Empty Cells
**Problem**: Color scale expects numeric values, parents have no data
**Solution**:
- Use `fill="transparent"` for parent cells (Phase 3)
- Skip color scale logic for parent nodes

---

## Files to Modify

### Required Changes:
1. **`src/components/pin-data/HaplotypeHeatmap.tsx`** (primary file)
   - Lines 289-294: Filtering logic
   - Lines 809-871: Connection line rendering
   - Lines ~920-980: Cell rendering
   - Lines ~880-910: Label rendering

### No Changes Needed:
- **`src/lib/taxonomic-tree-builder.ts`** - No changes required, existing data structure is sufficient
- **`src/components/pin-data/TaxonomicTreeView.tsx`** - Tree view component is separate

---

## Visual Design Reference

### Current Heatmap (Alphabetical Mode):
```
Species A     [██][  ][█ ]
Species B     [  ][██][  ]
Species C     [█ ][  ][██]
```

### New Heatmap (Hierarchical Mode with Parent Lines):
```
Genus X       [  ][  ][  ]  <-- Empty parent row
┊
├─ Species A  [██][  ][█ ]
┊
└─ Species B  [  ][██][  ]

Genus Y       [  ][  ][  ]
┊
Species C     [█ ][  ][██]
```

---

## User Acceptance Criteria

✅ Parent taxonomic levels (genus, family, etc.) are visible in hierarchical mode
✅ Visual lines connect parent nodes to their immediate children
✅ Lines appear on the left side of the heatmap, offset by indent level
✅ Parent rows show empty cells (no false data)
✅ Alphabetical mode unchanged (no parents, no lines)
✅ Performance is acceptable for typical datasets (50-200 species)
✅ Lines are visually distinguishable but not overwhelming

---

## Next Steps

Please review this plan and let me know if:
1. The visual design matches your expectation (based on your screenshot examples)
2. You want any modifications to the approach
3. You're ready to proceed with implementation

Once approved, I'll begin with Phase 1: Modifying the filtering logic to include parent nodes.

# Tree Duplicate Fix - Verification Guide

## Problem Fixed
Higher-order CSV entries (genus, family, etc.) were creating duplicate nodes in the taxonomic tree. For example, "Gadidae (fam.)" appeared twice - once as a semi-transparent parent and again as a full-color duplicate entry.

## Changes Made

### 1. `src/lib/taxonomic-tree-builder.ts`
- **Added `csvEntry` field** to TreeNode interface to track which nodes exist in CSV
- **Added `originalName` field** to preserve CSV names with rank annotations
- **Normalized node names** by removing rank annotations for matching
- **Implemented node merging** - when a node exists in both hierarchy and CSV, they merge into one node with `csvEntry: true`

### 2. `src/components/pin-data/TaxonomicTreeView.tsx`
- **Updated styling logic** to use `csvEntry` flag instead of `isLeaf`
- **Fixed display** to show `originalName` (with rank annotation) when available
- **Updated clickability** to work for all CSV entries, not just leaf nodes
- **Fixed badge display** to show haplotype counts for CSV entries

## How to Verify

### Quick Visual Test
1. Open the application at `http://localhost:9002`
2. Navigate to a _hapl file that contains higher-order entries (e.g., contains "Gadidae (fam.)" or "Trisopterus (gen.)")
3. Open the Taxonomic Tree View

**Expected Results:**
- ✅ NO duplicate entries for the same taxonomic name
- ✅ CSV entries (e.g., "Gadidae (fam.)") show in FULL COLOR (emerald background)
- ✅ Hierarchy-only parents show SEMI-TRANSPARENT (opacity-25)
- ✅ Higher-order CSV entries preserve their "(fam.)" or "(gen.)" annotations
- ✅ All CSV entries are clickable (not just species)

### Browser Console Verification Script

```javascript
// Run this in the browser console after opening a _hapl file

// Step 1: Find the tree data (you may need to expose it via window for testing)
// The tree is stored in HaplotypeHeatmap component state

// Step 2: Check for duplicates
function findDuplicates(node, path = [], results = []) {
  const seen = new Map();

  node.children.forEach(child => {
    const key = `${child.name}-${child.rank}`;

    if (seen.has(key)) {
      results.push({
        name: child.name,
        rank: child.rank,
        path: [...path, node.name],
        duplicate: true
      });
      console.error('❌ DUPLICATE FOUND:', {
        name: child.name,
        rank: child.rank,
        path: path.join(' > '),
        node1: seen.get(key),
        node2: child
      });
    }

    seen.set(key, child);

    // Recurse
    if (child.children.length > 0) {
      findDuplicates(child, [...path, child.name], results);
    }
  });

  return results;
}

// Step 3: Verify CSV entries are marked correctly
function verifyCsvEntries(node, level = 0) {
  const indent = '  '.repeat(level);

  if (node.name !== 'Life') {
    const status = node.csvEntry ? '✅ CSV' : '❌ Parent only';
    const name = node.originalName || node.name;
    console.log(`${indent}${status} | ${name} (${node.rank})`);

    if (node.csvEntry && !node.siteOccurrences) {
      console.warn(`${indent}⚠️  CSV entry missing siteOccurrences:`, node.name);
    }
  }

  node.children.forEach(child => verifyCsvEntries(child, level + 1));
}

// To use these functions, you'll need to access the tree data
// Option 1: Expose tree via React DevTools
// Option 2: Add console.log in HaplotypeHeatmap component temporarily
console.log('Verification functions loaded. Access tree data and run:');
console.log('findDuplicates(treeData)');
console.log('verifyCsvEntries(treeData)');
```

### Manual Test Cases

**Test Case 1: Gadidae (fam.) with children**
- CSV contains: "Gadidae (fam.)", "Trisopterus luscus (sp.)"
- Expected: ONE "Gadidae (fam.)" entry in full color with Trisopterus as child

**Test Case 2: Trisopterus (gen.) with children**
- CSV contains: "Trisopterus (gen.)", "Trisopterus luscus (sp.)"
- Expected: ONE "Trisopterus (gen.)" entry in full color with species as child

**Test Case 3: Species with no higher-order entries**
- CSV contains: "Merlangius merlangus (sp.)" only
- Expected: Hierarchy shows "Gadidae" (semi-transparent), "Merlangius" (semi-transparent), "Merlangius merlangus" (full color)

## Expected Before/After

### BEFORE (Broken)
```
├─ Gadidae (fam.)          [semi-transparent - parent from hierarchy]
│  └─ Trisopterus (gen.)
│     └─ Trisopterus luscus (sp.)
└─ Gadidae (fam.)          [full color - DUPLICATE from CSV]
```

### AFTER (Fixed)
```
├─ Gadidae (fam.)          [FULL COLOR - merged CSV + hierarchy]
│  ├─ Merlangius          [semi-transparent - parent only]
│  │  └─ Merlangius merlangus (sp.)  [full color]
│  └─ Trisopterus (gen.)   [full color - CSV entry with children]
│     └─ Trisopterus luscus (sp.)    [full color]
```

## Implementation Details

### Key Logic Changes

1. **Name Normalization** (line 79):
```typescript
const cleanedSpeciesName = speciesName.replace(/\s*\((phyl|infraclass|class|ord|fam|gen|sp)\.\)\s*$/i, '').trim();
```

2. **Path Building** (lines 114-118):
```typescript
path.push({
  name: cleanedSpeciesName,        // Use cleaned for matching
  rank: actualRank,
  originalName: speciesName !== cleanedSpeciesName ? speciesName : undefined
});
```

3. **Node Merging** (lines 144-157):
```typescript
if (childNode) {
  // Node exists - merge CSV entry data
  if (isLeafNode) {
    childNode.csvEntry = true;     // Mark as CSV entry
    childNode.isLeaf = true;       // Upgrade to leaf
    childNode.siteOccurrences = sites;
    childNode.confidence = confidence;
    childNode.source = source;
    if (originalName) {
      childNode.originalName = originalName;
    }
  }
}
```

## Files Modified
1. `src/lib/taxonomic-tree-builder.ts` - Core tree building logic
2. `src/components/pin-data/TaxonomicTreeView.tsx` - Display and styling

## Testing Checklist
- [ ] No duplicate entries in tree
- [ ] CSV entries show in full color
- [ ] Hierarchy-only parents show semi-transparent
- [ ] Rank annotations preserved (e.g., "(fam.)", "(gen.)")
- [ ] All CSV entries are clickable
- [ ] Haplotype counts display correctly
- [ ] Species count badges show on parent nodes
- [ ] Taxonomy source/confidence badges show on CSV entries

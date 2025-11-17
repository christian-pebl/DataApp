# VISUAL HIERARCHY EXAMPLE

## CSV Entry: Acartia tonsa (haplotype count = 15)

TREENODE HIERARCHY:
==================

Life (root)
└── Animalia (kingdom, not in CSV)
    └── Chordata (phylum, not in CSV)  
        └── Actinopterygii (class, not in CSV)
            └── Copepoda (order, not in CSV)
                └── Acartia (genus, NOT IN CSV - inferred from WoRMS)
                    └── Acartia tonsa (species, CSV ENTRY)
                        - csvEntry: true
                        - isLeaf: true
                        - siteOccurrences: Map{"Site1": 8, "Site2": 7}
                        - confidence: 'high'
                        - source: 'worms'


FLATTENEDTAXON FOR HEATMAP DISPLAY:
===================================

Depth-First Traversal (Alphabetical at each level):

Index | Name              | Rank    | IndentLevel | Path
------|-------------------|---------|-------------|-----
0     | Animalia          | kingdom | 0           | [Animalia]
1     | Chordata          | phylum  | 0           | [Animalia, Chordata]
2     | Actinopterygii    | class   | 2           | [Animalia, Chordata, Actinopterygii]
3     | Copepoda          | order   | 3           | [Animalia, Chordata, Actinopterygii, Copepoda]
4     | Acartia           | genus   | 5           | [Animalia, Chordata, Actinopterygii, Copepoda, Acartia]
5     | Acartia tonsa     | species | 6           | [Animalia, Chordata, Actinopterygii, Copepoda, Acartia, Acartia tonsa]

INDENT MAPPING (NOT tree depth, but rank-based):
- Animalia (kingdom) → indent 0
- Chordata (phylum) → indent 0
- Actinopterygii (class) → indent 2
- Copepoda (order) → indent 3
- Acartia (genus) → indent 5
- Acartia tonsa (species) → indent 6


HEATMAP Y-AXIS RENDERING:
=========================

In Hierarchical Mode (with connection lines):

Shows ALL nodes including parents (for visual hierarchy):

[K] Animalia
[P] Chordata
    [C] Actinopterygii
      [O] Copepoda
          [G] Acartia ──────── (connection lines to child)
                         [S] Acartia tonsa    │ 15 haplo. (data cell)


In Alphabetical Mode:

Shows ONLY leaf nodes (CSV entries):

[S] Acartia tonsa    │ 15 haplo. (data cell)


FINDING PARENT-CHILD RELATIONSHIPS:
====================================

Query: "Is Acartia tonsa a child of Acartia?"

Method 1 (FlattenedTaxon - Used in Heatmap):
  parent = flattenedTaxa[4] (Acartia, indent 5)
  child = flattenedTaxa[5] (Acartia tonsa, indent 6)
  
  Check: child.indentLevel (6) === parent.indentLevel (5) + 1? YES
  Check: parent.name ("Acartia") in child.path? YES
  Result: DIRECT CHILD


Method 2 (TreeNode - Used in Tree View):
  acartiaNode = root.children[0].children[0].children[0].children[0].children[0] (Acartia)
  acartiaNode.children[0] = Acartia tonsa
  Result: DIRECT CHILD


TREE VIEW DISPLAY:
==================

[K] Animalia (opacity 25%, not CSV)
  [P] Chordata (opacity 25%, not CSV)
    [C] Actinopterygii (opacity 25%, not CSV)
      [O] Copepoda (opacity 25%, not CSV)
        [G] Acartia (opacity 25%, not CSV)
          [S] Acartia tonsa (bg-emerald-50, clickable, 15 haplo.)


METADATA AT EACH LEVEL:
=======================

HaplotypeCellData (from CSV for Acartia tonsa at Site1):
  - species: "Acartia tonsa"
  - site: "Site1"
  - count: 8
  - metadata:
      - credibility: "HIGH"
      - phylum: "Chordata"
      - isInvasive: false
      - redListStatus: "Not Evaluated"
      - taxonomySource: "worms"
      - taxonId: "121706"
      - commonNames: ["Acartia copepod"]
      - fullHierarchy:
          - kingdom: "Animalia"
          - phylum: "Chordata"
          - class: "Actinopterygii"
          - order: "Copepoda"
          - family: (none for copepods)
          - genus: "Acartia"
          - species: "Acartia tonsa"
      - taxonomyConfidence: "high"
      - taxonomyRank: "sp."


SORTING ALGORITHM:
==================

HIERARCHICAL MODE (lines 289-294 in HaplotypeHeatmap.tsx):
1. Start with flattenedTaxa (all nodes in depth-first order)
2. Filter to only leaf nodes: taxon.node.isLeaf === true
3. Filter to only nodes that pass credibility filters
4. Result: Only CSV species entries, in hierarchical order

So Acartia tonsa appears, but Acartia (parent) does NOT appear as data row.
However, Acartia still renders with connection lines for visual hierarchy.


ALPHABETICAL MODE (lines 296-298 in HaplotypeHeatmap.tsx):
1. Get all filtered species names
2. Sort A-Z: array.sort((a, b) => a.localeCompare(b))
3. Result: Species listed alphabetically, no hierarchy visual


PARENT-CHILD LINE DRAWING (lines 809-871):
===========================================

Only in HIERARCHICAL mode, for EACH parent node:

1. Find children:
   - Look forward in flattenedTaxa from current index
   - Stop when indentLevel drops back to parent's level or lower
   - Include nodes where:
     * indentLevel === parent.indentLevel + 1
     * AND parent.name in child.path

2. Draw vertical line:
   - From parent.yPos to first child.yPos
   - If there's only 1 child, line ends at that child

3. Draw horizontal lines:
   - From parent.xPos to each child.xPos
   - At each child's yPos

Example: Acartia parent at x=120, y=100
         - Has 1 child: Acartia tonsa at x=180, y=150
         - Draw vertical: x=120, y=100 to y=150
         - Draw horizontal: x=120 to x=180, y=150
         - Forms an L-shape connecting parent to child


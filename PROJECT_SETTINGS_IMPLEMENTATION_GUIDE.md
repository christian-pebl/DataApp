# Project Settings Dialog Implementation Guide

## Overview
This document provides a comprehensive reference for all components related to the project settings dialog, side tab structure, and object selection functionality in the DataApp's map-drawing page.

---

## 1. Project Settings Dialog

### Location
File: src/app/map-drawing/page.tsx  
Lines: 8043-8111

### State Management
Lines: 661-664

- showProjectSettingsDialog (useState)
- projectNameEdit (useState)
- showDeleteConfirmDialog (useState)
- currentProjectContext (useState)

### Key Features
1. Project Name Input Field (line 8063-8067)
2. Delete Project Button (line 8075-8085)
3. Save Changes Button (line 8094-8106) - Currently shows "Feature Coming Soon"
4. Z-Index: z-[9999] for stacking context

### Dialog Triggers (Settings Cog Buttons)
1. Active Project Header (lines 6020-6031)
2. Project Menu Dropdown Items (lines 6408-6420)
3. Projects Dropdown Menu (lines 6012-6031)

---

## 2. Delete Project Confirmation Dialog

### Location
Lines: 8113-8205

### Features
- Warning alert with destructive list
- Shows items that will be deleted
- Loading state during deletion
- Error handling with toast notifications

### Deletion Logic
- Lines 8148-8194
- Retrieves project ID from context
- Calls projectService.deleteProject(projectId)
- Refreshes project list via loadDynamicProjects()

---

## 3. Side Tab / Sidebar Structure

### Main Sidebar Panel
Lines: 5740-5779

### Sidebar Styling
- Fixed positioning with animation
- Dynamic width (sidebarWidth state)
- Z-index: 1600
- Translation: -translate-x-full (closed) to translate-x-0 (open)

### State Management
- showMainMenu (line 418)
- sidebarWidth (line 426)
- originalSidebarWidth (line 427)
- isResizing (line 428)

### Key Features
1. Toggle Button (line 4277-4296) - Menu button in top-left
2. Resize Handle (lines 5757-5766) - Right edge resizing
3. Collapse Button (lines 5769-5777) - Closes sidebar

---

## 4. Active Project Overview Section

### Location
Lines: 5825-6237

### Components Included

#### Project Header
- Lines 5926-5952
- Project name, "Active Project" label
- Object count breakdown
- Expandable toggle

#### Action Buttons
- Lines 5953-6032
- Project Data, Toggle Labels, Toggle Objects, Settings buttons

#### Object Type Filter Buttons
- Lines 6043-6126
- All, Pins, Lines, Areas filters

#### Objects List
- Lines 6128-6237
- List of all project objects with:
  - Type indicator (icon)
  - Object name (clickable)
  - Data indicator (file count)
  - Label visibility toggle
  - Object visibility toggle

---

## 5. Object Selection State Management

### State Variables
- selectedObjectId (line 424)
- itemToEdit (line 928)

### Selection Behavior
- Clicking object toggles selection
- Sets both selectedObjectId and itemToEdit
- Visual feedback: bg-accent/20 border when selected

### Highlighting
- Selected objects show: bg-accent/20 border border-accent/40
- Unselected show: bg-muted/30

---

## 6. Type Filter State

### State Management
- objectTypeFilter (line 425)
- Type: 'all' | 'pin' | 'line' | 'area'

### Filter Buttons
- Lines 6048-6124
- Changes styling when selected
- Has tooltip on hover

---

## 7. Project Menu / Projects Dropdown

### Location
Lines: 6242-6448

### Structure
1. "Project Menu" Toggle Button (lines 6243-6258)
2. Projects Dropdown (lines 6261-6447)
   - Lists all projects
   - Active project appears first
   - Shows object count
   - Expand/collapse, visibility, activate buttons
3. Add New Project Button (lines 6432-6446)

---

## 8. UI Overlay & Greying Out

### Dialog Modal Behavior
- DialogContent uses z-[9999]
- Automatically creates semi-transparent backdrop
- Prevents interaction with content below
- open prop controls visibility
- onOpenChange handler manages state

### Affected Dialogs
- Project Settings Dialog
- Delete Confirmation Dialog
- Add Project Dialog
- Project Data Dialog
- File Selection Dialogs

---

## 9. Object Details Panel (Right Side)

### Location
Lines: 4300-5597

### Panel Structure
- Top-right corner when object selected
- Object icon and label
- Object details (coordinates, notes)
- Visibility toggles (checkboxes)
- Color and size picker
- Edit/Save buttons

### Modes
- View Mode (line 4333): Shows info, Edit button available
- Edit Mode (lines 5380-5596): Editable fields

---

## 10. Checkbox Components

### Usage Locations
1. Parameter Visibility Toggles (line 260-265)
2. Display Options (lines 5548-5575)
   - Show label on map
   - Show area fill

### Implementation
Uses Checkbox component with:
- id prop
- checked prop
- onCheckedChange handler

---

## 11. Sidebar Interaction Pattern

### Opening
1. Click Menu button
2. setShowMainMenu(true)
3. Sidebar translates from left: -translate-x-full to translate-x-0
4. Animation: 300ms ease-in-out

### Closing
1. Click Menu button, Collapse, or X
2. setShowMainMenu(false)
3. Sidebar translates back off-screen

### When Closed
- Menu button remains visible
- Map fully interactive
- No overlay or dimming

### When Open
- Sidebar occupies left portion
- Map behind sidebar (lower z-index)
- Sidebar resizable from right edge
- Interactions confined to sidebar

---

## 12. Z-Index Stacking Context

| Z-Index | Component | Purpose |
|---------|-----------|---------|
| 1600 | Sidebar | Main left panel |
| 1300 | Data dropdowns | Metadata selector |
| 1200 | Select dropdowns | Project, size |
| 1100 | Popovers | Color picker |
| 1000 | Main controls | Top buttons |
| 9999 | Dialogs | Modal overlays |

---

## 13. Key Events & Handlers

### closeMainMenu
- Sets showMainMenu = false
- Sidebar animates off-screen

### handleToggleAllObjects
- Location: Line 1764-1793
- Filters objects by project ID
- Updates visibility for pins, lines, areas

### handleToggleLabel
- Toggle individual object label visibility
- Updates labelVisible property

### handleToggleObjectVisibility
- Toggle individual object visibility
- Updates objectVisible property

---

## 14. Implementation Checklist for Project Rename (TODO #3)

### Current State
- Dialog structure exists
- Input field for project name
- Settings cog buttons trigger dialog
- MISSING: Project rename logic in Save handler
- MISSING: Database UPDATE query
- MISSING: State refresh after rename

### To Implement
1. Replace toast message (line 8097-8100)
2. Add validation for project name
3. Call database service to update project
4. Refresh project list on success
5. Handle errors appropriately

---

## Summary

The project settings implementation uses:

1. Dialog-Driven UI: Settings in modal dialogs (z-[9999])
2. State-Based Visibility: showProjectSettingsDialog, showMainMenu
3. Context Tracking: currentProjectContext maintains edited project
4. Sidebar Pattern: Left panel with resizable width
5. Object Selection: Single-select with selectedObjectId
6. Filtering: Type-based filtering
7. Batch Operations: Toggle all labels/visibility

This structure allows easy expansion while maintaining clean separation.

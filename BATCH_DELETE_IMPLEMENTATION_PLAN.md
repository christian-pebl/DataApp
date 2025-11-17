# Batch Object Delete with Multi-Selection - Implementation Plan

## 📋 Overview

Transform the project settings dialog to support **batch deletion** of objects (pins, lines, areas) with a multi-selection checkbox interface in the sidebar.

---

## 🎯 Current Behavior

### Sidebar Object List (lines 6128-6237)
- Shows all pins, lines, and areas for active project
- **Single selection** via click → opens detail editor on right
- Each object has: type indicator, name, file count badge, label toggle, visibility toggle
- Located in left sidebar at z-index 1600

### Project Settings Dialog (lines 8043-8111)
- Opens when clicking cog icon in project header
- Contains: project rename input, "Delete Project" button, "Save Changes" button
- Uses standard `Dialog` component with overlay at z-[9998] that **greys out entire screen**
- Dialog content at z-[9999]

### Problem
- Dialog overlay covers sidebar → cannot interact with object list
- No multi-selection capability
- No batch delete option

---

## ✨ Required Changes

### 1. **Remove Sidebar Greying**
   - Modify dialog overlay to NOT cover the left sidebar
   - Keep overlay on map and other UI elements
   - Sidebar should remain fully interactive when settings dialog is open

### 2. **Add Multi-Selection Checkboxes**
   - Add checkbox to the left of each object in the list
   - Support selecting multiple objects across types (pins + lines + areas)
   - Visual feedback: highlight selected rows

### 3. **Batch Delete Functionality**
   - When 1+ objects selected, show "Delete Selected Objects (N)" button in settings dialog
   - Replace or supplement "Delete Project" button
   - Confirmation dialog listing selected objects before deletion
   - Execute deletion in sequence with progress feedback

---

## 🔧 Technical Implementation

### **Step 1: Custom Dialog Overlay Component**

**File:** `src/components/ui/dialog.tsx`

**Create new variant: `SettingsDialog` with custom overlay**

```typescript
// New custom overlay that excludes sidebar
const SettingsDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Position overlay to start AFTER sidebar (left-[320px] or use CSS calc)
      "fixed top-0 right-0 bottom-0 left-[320px] z-[9998] bg-black/80",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));

// Custom dialog content that uses settings overlay
const SettingsDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <SettingsDialogOverlay /> {/* Use custom overlay */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Adjust positioning to account for visible sidebar
        "fixed left-[calc(320px+50%)] top-[50%] z-[9999]",
        "translate-x-[-50%] translate-y-[-50%]",
        "grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg",
        "duration-200 sm:rounded-lg",
        // Keep existing animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));

// Export
export { SettingsDialogContent }
```

**Alternative Simpler Approach:**
Instead of custom component, use Radix `modal={false}` prop:

```typescript
<Dialog modal={false} open={showProjectSettingsDialog} onOpenChange={...}>
```

This prevents the overlay entirely. Then manually add a positioned overlay div in the page component.

---

### **Step 2: Multi-Selection State Management**

**File:** `src/app/map-drawing/page.tsx`

**Add state (around line 660):**

```typescript
// Multi-selection state
const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set());
const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
```

**Add helper functions:**

```typescript
// Toggle checkbox selection
const toggleObjectSelection = (objectId: string) => {
  setSelectedObjectIds(prev => {
    const newSet = new Set(prev);
    if (newSet.has(objectId)) {
      newSet.delete(objectId);
    } else {
      newSet.add(objectId);
    }
    return newSet;
  });
};

// Select all filtered objects
const selectAllFilteredObjects = () => {
  const allObjects = [
    ...projectPins.map(p => p.id),
    ...projectLines.map(l => l.id),
    ...projectAreas.map(a => a.id)
  ].filter(id => {
    // Apply current objectTypeFilter
    const obj = [...projectPins, ...projectLines, ...projectAreas].find(o => o.id === id);
    if (!obj) return false;
    if (objectTypeFilter === 'all') return true;
    return obj.type === objectTypeFilter;
  });

  setSelectedObjectIds(new Set(allObjects));
};

// Clear all selections
const clearObjectSelection = () => {
  setSelectedObjectIds(new Set());
};

// Get selected objects with type info
const getSelectedObjects = (): Array<{ id: string; type: 'pin' | 'line' | 'area'; label: string }> => {
  return [
    ...projectPins.map(pin => ({ ...pin, type: 'pin' as const })),
    ...projectLines.map(line => ({ ...line, type: 'line' as const })),
    ...projectAreas.map(area => ({ ...area, type: 'area' as const }))
  ].filter(obj => selectedObjectIds.has(obj.id));
};
```

---

### **Step 3: Checkbox UI in Object List**

**File:** `src/app/map-drawing/page.tsx` (lines 6143-6232)

**Modify object list item structure:**

```typescript
<div
  key={object.id}
  className={`w-full flex items-center gap-2 p-2 rounded text-xs transition-all ${
    selectedObjectIds.has(object.id)
      ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-400'
      : selectedObjectId === object.id
        ? 'bg-accent/20 border border-accent/40'
        : 'bg-muted/30'
  }`}
>
  {/* ADD CHECKBOX HERE - Left-most */}
  <Checkbox
    checked={selectedObjectIds.has(object.id)}
    onCheckedChange={() => toggleObjectSelection(object.id)}
    onClick={(e) => e.stopPropagation()}
    className="flex-shrink-0"
  />

  {/* Type indicator (existing) */}
  {object.type === 'pin' && (
    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
  )}
  {object.type === 'line' && (
    <div className="w-4 h-0.5 bg-green-500 flex-shrink-0"></div>
  )}
  {object.type === 'area' && (
    <div className="w-3 h-3 bg-red-500/30 border border-red-500 flex-shrink-0"></div>
  )}

  {/* Object name button (existing - keep for single-select edit mode) */}
  <button
    onClick={() => {
      // Single-select for editing (right panel)
      setSelectedObjectId(selectedObjectId === object.id ? null : object.id);
      setItemToEdit(object);
    }}
    className="truncate flex-1 text-left hover:text-accent"
  >
    {object.label || `Unnamed ${object.type.charAt(0).toUpperCase() + object.type.slice(1)}`}
  </button>

  {/* Rest of existing UI (file count, toggles, etc.) */}
  <div className="flex items-center gap-1 ml-auto">
    {/* ... existing code for file indicator, label toggle, visibility toggle ... */}
  </div>
</div>
```

**Add bulk selection controls (above object list, around line 6043):**

```typescript
{/* Bulk selection controls */}
{selectedObjectIds.size > 0 && (
  <div className="flex items-center justify-between p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-xs border border-blue-400">
    <span className="font-medium">
      {selectedObjectIds.size} object{selectedObjectIds.size !== 1 ? 's' : ''} selected
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={clearObjectSelection}
      className="h-6 px-2 text-xs"
    >
      Clear
    </Button>
  </div>
)}

{/* Select All / Deselect All button */}
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    if (selectedObjectIds.size > 0) {
      clearObjectSelection();
    } else {
      selectAllFilteredObjects();
    }
  }}
  className="w-full text-xs"
>
  {selectedObjectIds.size > 0 ? 'Deselect All' : 'Select All'}
</Button>
```

---

### **Step 4: Batch Delete in Settings Dialog**

**File:** `src/app/map-drawing/page.tsx` (lines 8043-8111)

**Replace Dialog with custom SettingsDialogContent:**

```typescript
{/* Project Settings Dialog */}
<Dialog
  modal={false}  {/* Allow sidebar interaction */}
  open={showProjectSettingsDialog}
  onOpenChange={(open) => {
    if (!open) {
      setCurrentProjectContext('');
      clearObjectSelection(); // Clear selections when closing
    }
    setShowProjectSettingsDialog(open);
  }}
>
  <SettingsDialogContent className="sm:max-w-md z-[9999]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Project Settings
      </DialogTitle>
      <DialogDescription>
        Manage settings for {dynamicProjects[currentProjectContext || activeProjectId]?.name}
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Project Name (existing) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Project Name</label>
        <Input
          value={projectNameEdit}
          onChange={(e) => setProjectNameEdit(e.target.value)}
          placeholder="Enter project name"
        />
      </div>

      {/* BATCH DELETE SECTION - Show when objects selected */}
      {selectedObjectIds.size > 0 && (
        <div className="p-4 border border-orange-500 rounded bg-orange-50 dark:bg-orange-950/20">
          <h3 className="text-sm font-semibold mb-2 text-orange-900 dark:text-orange-200">
            Batch Delete
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            You have selected {selectedObjectIds.size} object{selectedObjectIds.size !== 1 ? 's' : ''} to delete
          </p>

          {/* List selected objects */}
          <div className="space-y-1 max-h-32 overflow-y-auto mb-3 text-xs">
            {getSelectedObjects().map(obj => (
              <div key={obj.id} className="flex items-center gap-2">
                {obj.type === 'pin' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                {obj.type === 'line' && <div className="w-3 h-0.5 bg-green-500"></div>}
                {obj.type === 'area' && <div className="w-2 h-2 bg-red-500/30 border border-red-500"></div>}
                <span>{obj.label || `Unnamed ${obj.type}`}</span>
              </div>
            ))}
          </div>

          <Button
            variant="destructive"
            onClick={() => {
              setShowProjectSettingsDialog(false);
              setShowBatchDeleteConfirmDialog(true);
            }}
            className="w-full flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected Objects ({selectedObjectIds.size})
          </Button>
        </div>
      )}

      {/* Actions (existing) */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="destructive"
          onClick={() => {
            setShowProjectSettingsDialog(false);
            setShowDeleteConfirmDialog(true);
          }}
          className="flex items-center gap-2"
          disabled={selectedObjectIds.size > 0} // Disable if batch mode active
        >
          <Trash2 className="h-4 w-4" />
          Delete Project
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowProjectSettingsDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              // TODO: Implement project rename functionality
              toast({
                title: "Feature Coming Soon",
                description: "Project renaming will be available in a future update.",
                duration: 3000
              });
              setShowProjectSettingsDialog(false);
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  </SettingsDialogContent>
</Dialog>
```

---

### **Step 5: Batch Delete Confirmation Dialog**

**File:** `src/app/map-drawing/page.tsx`

**Add new state (around line 663):**

```typescript
const [showBatchDeleteConfirmDialog, setShowBatchDeleteConfirmDialog] = useState(false);
```

**Add new confirmation dialog (after existing delete confirm dialog, around line 8150):**

```typescript
{/* Batch Delete Confirmation Dialog */}
<Dialog open={showBatchDeleteConfirmDialog} onOpenChange={setShowBatchDeleteConfirmDialog}>
  <DialogContent className="sm:max-w-md z-[9999]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        Confirm Batch Deletion
      </DialogTitle>
      <DialogDescription>
        This action cannot be undone. The following {selectedObjectIds.size} object{selectedObjectIds.size !== 1 ? 's' : ''} will be permanently deleted:
      </DialogDescription>
    </DialogHeader>

    {/* List of objects to delete */}
    <div className="max-h-48 overflow-y-auto border rounded p-3 space-y-2">
      {getSelectedObjects().map(obj => {
        const fileCount = obj.type === 'pin'
          ? (pinFileMetadata[obj.id]?.length || pinFiles[obj.id]?.length || 0)
          : obj.type === 'area'
          ? (areaFileMetadata[obj.id]?.length || 0)
          : 0;

        return (
          <div key={obj.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {obj.type === 'pin' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              {obj.type === 'line' && <div className="w-3 h-0.5 bg-green-500"></div>}
              {obj.type === 'area' && <div className="w-2 h-2 bg-red-500/30 border border-red-500"></div>}
              <span className="font-medium">{obj.label || `Unnamed ${obj.type}`}</span>
            </div>
            {fileCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        );
      })}
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setShowBatchDeleteConfirmDialog(false)}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={handleBatchDelete}
      >
        Delete {selectedObjectIds.size} Object{selectedObjectIds.size !== 1 ? 's' : ''}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### **Step 6: Batch Delete Handler Function**

**File:** `src/app/map-drawing/page.tsx`

**Add handler (around line 1660):**

```typescript
// Batch delete handler
const handleBatchDelete = async () => {
  const objectsToDelete = getSelectedObjects();
  const totalCount = objectsToDelete.length;
  let successCount = 0;
  let errorCount = 0;

  // Show loading toast
  const loadingToast = toast({
    title: "Deleting Objects...",
    description: `Deleting ${totalCount} object${totalCount !== 1 ? 's' : ''}...`,
    duration: Infinity, // Keep until we dismiss it
  });

  // Delete each object sequentially
  for (const obj of objectsToDelete) {
    try {
      if (obj.type === 'pin') {
        await deletePinData(obj.id);
      } else if (obj.type === 'line') {
        await deleteLineData(obj.id);
      } else if (obj.type === 'area') {
        await deleteAreaData(obj.id);
      }
      successCount++;
    } catch (error) {
      console.error(`Error deleting ${obj.type} ${obj.id}:`, error);
      errorCount++;
    }
  }

  // Dismiss loading toast
  loadingToast.dismiss();

  // Show result toast
  if (errorCount === 0) {
    toast({
      title: "Batch Delete Complete",
      description: `Successfully deleted ${successCount} object${successCount !== 1 ? 's' : ''}.`,
      duration: 5000,
    });
  } else {
    toast({
      variant: errorCount === totalCount ? "destructive" : "default",
      title: "Batch Delete Complete with Errors",
      description: `Deleted ${successCount} object${successCount !== 1 ? 's' : ''}, ${errorCount} failed.`,
      duration: 7000,
    });
  }

  // Clear selections and close dialog
  clearObjectSelection();
  setShowBatchDeleteConfirmDialog(false);
};
```

---

## 📝 Additional Improvements

### **1. Enter Multi-Select Mode via Settings Cog**
When user clicks settings cog, automatically enable multi-select mode in sidebar:

```typescript
const handleOpenProjectSettings = () => {
  setShowProjectSettingsDialog(true);
  setIsMultiSelectMode(true); // Enable checkbox mode
};
```

### **2. Visual Mode Indicator**
Show indicator in sidebar when multi-select mode is active:

```typescript
{isMultiSelectMode && (
  <div className="flex items-center gap-2 p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-xs mb-2">
    <CheckSquare className="h-3 w-3" />
    <span>Multi-select mode active</span>
  </div>
)}
```

### **3. Disable Edit Panel During Multi-Select**
When multi-select is active, don't open the right detail panel:

```typescript
<button
  onClick={() => {
    if (!isMultiSelectMode) {
      setSelectedObjectId(selectedObjectId === object.id ? null : object.id);
      setItemToEdit(object);
    }
  }}
  className={`truncate flex-1 text-left ${!isMultiSelectMode ? 'hover:text-accent cursor-pointer' : 'cursor-default'}`}
>
```

### **4. Keyboard Shortcuts**
- `Ctrl/Cmd + A`: Select all filtered objects
- `Escape`: Clear selection / exit multi-select mode

---

## 🎨 UX Flow

1. User clicks **cog icon** in project header
2. **Settings dialog opens** on right side (sidebar remains interactive)
3. **Checkboxes appear** next to all objects in sidebar
4. User **checks multiple objects** (pins, lines, areas)
5. Selected count shows in **blue banner** at top of object list
6. Settings dialog shows **"Delete Selected Objects (N)" button** in orange section
7. User clicks **batch delete button**
8. **Confirmation dialog** shows list of objects to delete with file counts
9. User confirms → **Sequential deletion** with progress toast
10. **Success toast** shows final count
11. Selections cleared, dialog closes

---

## 🧪 Testing Checklist

- [ ] Settings dialog opens without greying sidebar
- [ ] Checkboxes appear for all objects
- [ ] Can select/deselect individual objects
- [ ] Can select all / clear all
- [ ] Selected count updates correctly
- [ ] Batch delete button appears when objects selected
- [ ] Batch delete shows correct object list in confirmation
- [ ] Deletion works for pins, lines, areas
- [ ] Success/error toasts show correctly
- [ ] Objects removed from map and sidebar after deletion
- [ ] Right detail panel doesn't open during multi-select
- [ ] Closing dialog clears selections
- [ ] Works with type filter (All, Pins, Lines, Areas)

---

## 📦 Required Imports

**Add to `src/app/map-drawing/page.tsx`:**

```typescript
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare, AlertTriangle } from 'lucide-react';
```

**Create/export in `src/components/ui/dialog.tsx`:**

```typescript
export { SettingsDialogContent }
```

---

## 🚀 Implementation Order

1. ✅ **Step 1**: Create `SettingsDialogContent` in dialog.tsx
2. ✅ **Step 2**: Add multi-selection state to page.tsx
3. ✅ **Step 3**: Add checkboxes to object list
4. ✅ **Step 4**: Update settings dialog to use custom content + show batch delete UI
5. ✅ **Step 5**: Create batch delete confirmation dialog
6. ✅ **Step 6**: Implement `handleBatchDelete` function
7. ✅ **Step 7**: Test and refine UX

---

## ⚠️ Edge Cases to Handle

- **Empty selection**: Don't show batch delete UI if no objects selected
- **All objects deleted**: Show "No objects in project" message
- **Partial deletion failures**: Show which objects failed
- **Dialog closed mid-selection**: Clear selections on dialog close
- **File attachments**: Batch delete handles objects with uploaded files
- **Type filtering**: Select All respects current filter (pins/lines/areas/all)
- **Concurrent edits**: Disable single-select edit mode during multi-select

---

## 📄 Files Modified

| File | Lines Modified | Purpose |
|------|----------------|---------|
| `src/components/ui/dialog.tsx` | Add ~30 lines | Custom `SettingsDialogContent` |
| `src/app/map-drawing/page.tsx` | Lines 660-685 | Add multi-select state |
| `src/app/map-drawing/page.tsx` | Lines 1660-1720 | Add `handleBatchDelete` + helpers |
| `src/app/map-drawing/page.tsx` | Lines 6040-6070 | Add bulk selection controls |
| `src/app/map-drawing/page.tsx` | Lines 6143-6232 | Add checkboxes to object list |
| `src/app/map-drawing/page.tsx` | Lines 8043-8111 | Update settings dialog |
| `src/app/map-drawing/page.tsx` | Lines 8150-8220 | Add batch delete confirmation |

---

## ✨ Summary

This implementation transforms the project settings workflow by:

1. **Keeping sidebar interactive** during settings dialog (custom overlay)
2. **Enabling multi-selection** via checkboxes in object list
3. **Adding batch delete** functionality with clear confirmation
4. **Maintaining single-select** behavior for editing individual objects
5. **Providing clear visual feedback** at every step

The result is a powerful bulk management interface that significantly improves UX for users managing large numbers of map objects.

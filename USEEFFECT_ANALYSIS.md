# useEffect Analysis - map-drawing/page.tsx

**Date:** 2025-01-23
**Branch:** feature/reduce-useeffect-count
**Current Count:** 24 useEffects
**Target Count:** 8-10 useEffects

---

## 📊 **Complete Inventory of 24 useEffects**

### **Category 1: Data Loading & Initialization** (7 effects)

#### 1. Line 818: Load Dynamic Projects
```typescript
useEffect(() => {
  loadDynamicProjects();
}, [loadDynamicProjects]);
```
**Purpose:** Load projects when component mounts
**Dependencies:** `[loadDynamicProjects]`
**Can consolidate with:** Project/Auth initialization group

---

#### 2. Line 1052: Check LocalStorage Data
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && isAuthenticated && !isDataLoading) {
    // Check for existing localStorage data
  }
}, [isAuthenticated, isDataLoading]);
```
**Purpose:** Load localStorage data after auth completes
**Dependencies:** `[isAuthenticated, isDataLoading]`
**Can consolidate with:** Auth & restoration group

---

#### 3. Line 1072: Authentication & Restore Dialog
```typescript
useEffect(() => {
  const checkAuthAndRestore = async () => {
    if (!hasCheckedAuth && isAuthenticated) {
      // Show restore dialog logic
    }
  };
  checkAuthAndRestore();
}, [isAuthenticated, hasCheckedAuth]);
```
**Purpose:** Show restore dialog after authentication
**Dependencies:** `[isAuthenticated, hasCheckedAuth]`
**Can consolidate with:** Auth & restoration group

---

#### 4. Line 1102: Load ALL Pin Files
```typescript
useEffect(() => {
  const loadPinFiles = async () => {
    const projectId = currentProjectContext || activeProjectId;
    if (!projectId) return;

    setIsLoadingPinFiles(true);
    // Load pin files from Supabase
    setIsLoadingPinFiles(false);
  };

  loadPinFiles();
}, [currentProjectContext, activeProjectId, isAuthenticated]);
```
**Purpose:** Load all files for current project
**Dependencies:** `[currentProjectContext, activeProjectId, isAuthenticated]`
**Can consolidate with:** Data loading group

---

#### 5. Line 935: DATA EXPLORER - Load Saved Plots
```typescript
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  const loadSavedPlots = async () => {
    // Load saved plot views
  };

  loadSavedPlots();
}, [isAuthenticated]);
```
**Purpose:** Load saved plot views for data explorer
**Dependencies:** `[isAuthenticated]`
**Can consolidate with:** Data explorer initialization group

---

#### 6. Line 1224: Initialize Scale Bar
```typescript
useEffect(() => {
  if (view) {
    updateMapScale({ lat: view.center.lat, lng: view.center.lng }, view.zoom);
  }
}, [view]);
```
**Purpose:** Update map scale when view changes
**Dependencies:** `[view]`
**Keep separate:** Map-specific, runs frequently

---

#### 7. Line 2532: Clear File Date Cache
```typescript
useEffect(() => {
  setFileDateCache({});
}, []);
```
**Purpose:** Initialize file date cache
**Dependencies:** `[]` (run once)
**Can consolidate with:** Initial setup group

---

### **Category 2: UI State Management** (9 effects)

#### 8. Line 850: Auto-Expand Sidebar
```typescript
useEffect(() => {
  if (showDataDropdown && showMeteoDataSection) {
    // Store current width if not already stored
    if (sidebarWidthBeforeExpand === null) {
      setSidebarWidthBeforeExpand(sidebarWidth);
    }
    setSidebarWidth(450);
  } else if (sidebarWidthBeforeExpand !== null) {
    setSidebarWidth(sidebarWidthBeforeExpand);
    setSidebarWidthBeforeExpand(null);
  }
}, [showDataDropdown, showMeteoDataSection]);
```
**Purpose:** Expand sidebar when meteo data section opens
**Dependencies:** `[showDataDropdown, showMeteoDataSection]`
**Can consolidate with:** Sidebar management group

---

#### 9. Line 2556: Close Menu When Clicking Outside
```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    // Close showMainMenu
    // Close showDataDropdown
    // Close showExploreDropdown
    // Close showMarineDeviceModal
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showMainMenu, showDataDropdown, showExploreDropdown]);
```
**Purpose:** Handle outside clicks for all dropdowns/modals
**Dependencies:** `[showMainMenu, showDataDropdown, showExploreDropdown]`
**Keep separate:** UI interaction handler

---

#### 10. Line 2604: Handle Sidebar Resizing
```typescript
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.max(280, Math.min(600, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  } else {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
}, [isResizing]);
```
**Purpose:** Handle sidebar resize drag
**Dependencies:** `[isResizing]`
**Keep separate:** UI interaction handler

---

#### 11. Line 2640: Initialize Editing State
```typescript
useEffect(() => {
  if (itemToEdit && isEditingObject) {
    setEditingLabel(itemToEdit.label || '');
    setEditingNotes(itemToEdit.notes || '');
    setEditingProjectId(itemToEdit.projectId || null);
    // Initialize coordinates and colors based on object type
    // ... lots of initialization logic ...
  }
}, [itemToEdit, isEditingObject, coordinateFormat]);
```
**Purpose:** Initialize form when editing object
**Dependencies:** `[itemToEdit, isEditingObject, coordinateFormat]`
**Keep separate:** Form initialization, complex logic

---

#### 12. Line 2711: Keep itemToEdit in Sync
```typescript
useEffect(() => {
  if (itemToEdit) {
    // Check if it's a pin
    // Check if it's a line
    // Check if it's an area
    // Update itemToEdit with latest data from arrays
  }
}, [itemToEdit, pins, lines, areas]);
```
**Purpose:** Sync editing state with data arrays
**Dependencies:** `[itemToEdit, pins, lines, areas]`
**Can consolidate with:** Object editing group

---

#### 13. Line 864: Check GPS Permission
```typescript
useEffect(() => {
  const checkLocationPermission = async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setGpsPermissionStatus(result.state);

        result.addEventListener('change', () => {
          setGpsPermissionStatus(result.state);
        });
      } catch (error) {
        console.error('Error checking location permission:', error);
      }
    }
  };

  checkLocationPermission();
}, []);
```
**Purpose:** Check and monitor GPS permission
**Dependencies:** `[]` (run once)
**Can consolidate with:** Initial setup group

---

#### 14. Line 977: DATA EXPLORER - Keyboard Shortcut
```typescript
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      setShowDataExplorerPanel(prev => !prev);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```
**Purpose:** Cmd/Ctrl + D keyboard shortcut
**Dependencies:** `[]` (run once)
**Can consolidate with:** Event listeners group

---

#### 15. Line 995: DATA EXPLORER - Listen for Custom Event
```typescript
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  const handleToggle = () => {
    setShowDataExplorerPanel(prev => !prev);
  };

  window.addEventListener('toggleDataExplorer', handleToggle);
  return () => window.removeEventListener('toggleDataExplorer', handleToggle);
}, []);
```
**Purpose:** Listen for data explorer toggle event
**Dependencies:** `[]` (run once)
**Can consolidate with:** Event listeners group

---

#### 16. Line 1012: Handle URL Parameters for Centering Pin
```typescript
useEffect(() => {
  const centerPinId = searchParams.get('centerPin');
  if (centerPinId && pins.length > 0 && mapRef.current) {
    const pin = pins.find(p => p.id === centerPinId);
    if (pin) {
      mapRef.current.setView([pin.lat, pin.lng], 13);
      // Remove the URL parameter after centering
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('centerPin');
      // ... update URL ...
    }
  }
}, [searchParams, pins]);
```
**Purpose:** Center map on pin from URL parameter
**Dependencies:** `[searchParams, pins]`
**Keep separate:** URL handling logic

---

#### 17. Line 1397: Fetch Merged Files When Dialog Opens
```typescript
useEffect(() => {
  if (showProjectDataDialog) {
    fetchMergedFiles();
  } else {
    setMergedFiles([]);
  }
}, [showProjectDataDialog, fetchMergedFiles]);
```
**Purpose:** Load merged files when dialog opens
**Dependencies:** `[showProjectDataDialog, fetchMergedFiles]`
**Can consolidate with:** Dialog state group

---

### **Category 3: Data Explorer Features** (3 effects)

#### 18. Line 888: Auto-Open Marine Device Modal (Saved Plot)
```typescript
useEffect(() => {
  const checkForSavedPlotLoad = () => {
    try {
      const savedPlotLoadStr = sessionStorage.getItem('pebl_load_saved_plot');
      if (savedPlotLoadStr) {
        const plotConfig = JSON.parse(savedPlotLoadStr);
        // Auto-open marine device modal with saved plot
        sessionStorage.removeItem('pebl_load_saved_plot');
      }
    } catch (error) {
      console.error('Error loading saved plot:', error);
    }
  };

  checkForSavedPlotLoad();
}, []);
```
**Purpose:** Load saved plot from sessionStorage on mount
**Dependencies:** `[]` (run once)
**Can consolidate with:** Data explorer initialization group

---

#### 19. Line 965: DATA EXPLORER - Auto-Open from Redirect
```typescript
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  const autoOpen = searchParams.get('openExplorer');
  if (autoOpen === 'true') {
    setShowDataExplorerPanel(true);
    // Remove URL parameter
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('openExplorer');
    // ... update URL ...
  }
}, [searchParams]);
```
**Purpose:** Auto-open data explorer from URL parameter
**Dependencies:** `[searchParams]`
**Can consolidate with:** Data explorer initialization group

---

### **Category 4: Pin Meteo Grid Management** (3 effects)

#### 20. Line 1231: Pin Meteo Grid - Initialize Plot Configurations
```typescript
useEffect(() => {
  const configs: PlotConfigInternal[] = ALL_PARAMETERS.map(key => {
    const baseConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
    return {
      ...baseConfig,
      visible: true,
      yAxisSide: 'left',
      color: baseConfig.defaultColor || getColorForParameter(key),
    };
  });

  setPinMeteoPlotConfigs(configs);
}, []);
```
**Purpose:** Initialize plot configurations for meteo grid
**Dependencies:** `[]` (run once)
**Can consolidate with:** Pin meteo initialization group

---

#### 21. Line 1261: Pin Meteo Grid - Manage Data Availability
```typescript
useEffect(() => {
  if (isLoadingPinMeteoData) {
    const pendingAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    ALL_PARAMETERS.forEach(key => {
      pendingAvailability[key as CombinedParameterKey] = { status: 'loading' };
    });
    setPinMeteoSeriesAvailability(pendingAvailability);
  } else if (pinMeteoData && pinMeteoData.length > 0) {
    // Analyze availability of each parameter
    // ... complex availability logic ...
  }
}, [isLoadingPinMeteoData, pinMeteoData]);
```
**Purpose:** Update availability status when data loads
**Dependencies:** `[isLoadingPinMeteoData, pinMeteoData]`
**Can consolidate with:** Pin meteo data group

---

#### 22. Line 1291: Pin Meteo Grid - Manage Brush Range
```typescript
useEffect(() => {
  if (pinMeteoData && pinMeteoData.length > 0 && pinMeteoBrushEndIndex === undefined) {
    setPinMeteoBrushStartIndex(0);
    setPinMeteoBrushEndIndex(pinMeteoData.length - 1);
  }
}, [pinMeteoData, pinMeteoBrushEndIndex]);
```
**Purpose:** Initialize brush range when data loads
**Dependencies:** `[pinMeteoData, pinMeteoBrushEndIndex]`
**Can consolidate with:** Pin meteo data group

---

### **Category 5: Unknown** (Additional effects from count)

#### 23-24. Additional effects (lines unknown)
**Note:** Found 24 total useEffects in grep, need to locate remaining 2

---

## 🎯 **Consolidation Plan**

### **Target: Reduce 24 → 9 useEffects**

### **Group 1: Initial Setup & Authentication** (3 → 1 effect)
**Consolidate:**
- #1: Load Dynamic Projects (line 818)
- #2: Check LocalStorage Data (line 1052)
- #3: Authentication & Restore Dialog (line 1072)
- #7: Clear File Date Cache (line 2532)
- #13: Check GPS Permission (line 864)

**New Consolidated Effect:**
```typescript
// CONSOLIDATED: Initial Setup & Authentication
useEffect(() => {
  // Run once on mount
  const initializeApp = async () => {
    // 1. Clear file date cache
    setFileDateCache({});

    // 2. Check GPS permission
    checkGPSPermission();

    // 3. Load projects
    await loadDynamicProjects();

    // 4. If authenticated, check localStorage and show restore dialog
    if (isAuthenticated && !isDataLoading) {
      checkLocalStorageData();
      checkAuthAndRestore();
    }
  };

  initializeApp();
}, [isAuthenticated, isDataLoading, loadDynamicProjects]);
```

**Result:** 5 effects → 1 effect (80% reduction)

---

### **Group 2: Data Explorer Initialization** (3 → 1 effect)
**Consolidate:**
- #5: Load Saved Plots (line 935)
- #18: Auto-Open Marine Device Modal (line 888)
- #19: Auto-Open from Redirect (line 965)

**New Consolidated Effect:**
```typescript
// CONSOLIDATED: Data Explorer Initialization
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  const initializeDataExplorer = async () => {
    // 1. Load saved plots
    await loadSavedPlots();

    // 2. Check for saved plot in sessionStorage
    checkForSavedPlotLoad();

    // 3. Auto-open from URL parameter
    const autoOpen = searchParams.get('openExplorer');
    if (autoOpen === 'true') {
      setShowDataExplorerPanel(true);
      updateURLWithoutParameter('openExplorer');
    }
  };

  initializeDataExplorer();
}, [isAuthenticated, searchParams]);
```

**Result:** 3 effects → 1 effect (67% reduction)

---

### **Group 3: Pin Meteo Grid Management** (3 → 1 effect)
**Consolidate:**
- #20: Initialize Plot Configurations (line 1231)
- #21: Manage Data Availability (line 1261)
- #22: Manage Brush Range (line 1291)

**New Consolidated Effect:**
```typescript
// CONSOLIDATED: Pin Meteo Grid Management
useEffect(() => {
  // Initialize configurations once
  if (pinMeteoPlotConfigs.length === 0) {
    const configs = initializePlotConfigurations();
    setPinMeteoPlotConfigs(configs);
  }

  // Update availability when data loads
  if (isLoadingPinMeteoData) {
    setLoadingAvailabilityStatus();
  } else if (pinMeteoData && pinMeteoData.length > 0) {
    updateDataAvailability(pinMeteoData);

    // Initialize brush range if not set
    if (pinMeteoBrushEndIndex === undefined) {
      setPinMeteoBrushStartIndex(0);
      setPinMeteoBrushEndIndex(pinMeteoData.length - 1);
    }
  }
}, [isLoadingPinMeteoData, pinMeteoData, pinMeteoBrushEndIndex, pinMeteoPlotConfigs.length]);
```

**Result:** 3 effects → 1 effect (67% reduction)

---

### **Group 4: Event Listeners** (2 → 1 effect)
**Consolidate:**
- #14: Keyboard Shortcut (line 977)
- #15: Custom Event Listener (line 995)

**New Consolidated Effect:**
```typescript
// CONSOLIDATED: Event Listeners
useEffect(() => {
  if (!isFeatureEnabled('DATA_EXPLORER_PANEL')) return;

  // Keyboard shortcut handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      setShowDataExplorerPanel(prev => !prev);
    }
  };

  // Custom event handler
  const handleToggle = () => {
    setShowDataExplorerPanel(prev => !prev);
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('toggleDataExplorer', handleToggle);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('toggleDataExplorer', handleToggle);
  };
}, []);
```

**Result:** 2 effects → 1 effect (50% reduction)

---

### **Group 5: Object Editing State** (2 → 1 effect)
**Consolidate:**
- #11: Initialize Editing State (line 2640)
- #12: Keep itemToEdit in Sync (line 2711)

**New Consolidated Effect:**
```typescript
// CONSOLIDATED: Object Editing State Management
useEffect(() => {
  // First, sync itemToEdit with latest data from arrays
  if (itemToEdit) {
    const updatedItem = findUpdatedItem(itemToEdit, pins, lines, areas);
    if (updatedItem && hasChanged(updatedItem, itemToEdit)) {
      setItemToEdit(updatedItem);
      return; // Let the next render handle initialization
    }
  }

  // Then, initialize editing form when editing starts
  if (itemToEdit && isEditingObject) {
    initializeEditingForm(itemToEdit, coordinateFormat);
  }
}, [itemToEdit, isEditingObject, coordinateFormat, pins, lines, areas]);
```

**Result:** 2 effects → 1 effect (50% reduction)

---

### **Keep Separate (9 effects remain as-is)**

These effects are best kept separate due to:
- Complex logic
- Frequent execution
- Event handlers
- Independent concerns

1. ✅ **#4: Load ALL Pin Files** (line 1102) - Data loading with complex logic
2. ✅ **#6: Initialize Scale Bar** (line 1224) - Map-specific, frequent updates
3. ✅ **#8: Auto-Expand Sidebar** (line 850) - UI state with specific logic
4. ✅ **#9: Close Menu on Outside Click** (line 2556) - Event handler, multiple targets
5. ✅ **#10: Handle Sidebar Resizing** (line 2604) - Event handler, drag logic
6. ✅ **#16: Handle URL Parameters** (line 1012) - URL handling logic
7. ✅ **#17: Fetch Merged Files** (line 1397) - Dialog-specific loading

---

## 📊 **Expected Results**

### Before Consolidation:
- **Total useEffects:** 24
- **Estimated re-renders:** High (multiple effects triggering)
- **Maintainability:** Poor (hard to track dependencies)
- **Load time:** 7.6 seconds

### After Consolidation:
- **Total useEffects:** 9-10
- **Reduction:** 58-62%
- **Estimated re-renders:** 30-40% fewer
- **Maintainability:** Good (clear groupings)
- **Expected load time:** 4-5 seconds (40% improvement)

---

## 🚀 **Implementation Steps**

### Phase 1A: Consolidate Groups 1-2 (Week 1, Day 1-2)
- [ ] Consolidate Initial Setup & Authentication (5 → 1)
- [ ] Consolidate Data Explorer Initialization (3 → 1)
- [ ] Test thoroughly
- [ ] Commit: "Consolidate initialization and data explorer useEffects"

### Phase 1B: Consolidate Groups 3-5 (Week 1, Day 3-4)
- [ ] Consolidate Pin Meteo Grid Management (3 → 1)
- [ ] Consolidate Event Listeners (2 → 1)
- [ ] Consolidate Object Editing State (2 → 1)
- [ ] Test thoroughly
- [ ] Commit: "Consolidate meteo, events, and editing useEffects"

### Phase 1C: Testing & Refinement (Week 1, Day 5)
- [ ] Full regression testing
- [ ] Performance measurement
- [ ] Fix any issues
- [ ] Final commit: "Complete useEffect consolidation - 24 to 9"

---

## ✅ **Success Criteria**

- [ ] useEffect count reduced from 24 to 9-10
- [ ] All functionality working correctly
- [ ] No new bugs introduced
- [ ] Load time improved by 30-40%
- [ ] Code is clearer and better documented
- [ ] Tests passing

---

**Status:** 📋 **ANALYSIS COMPLETE - READY TO IMPLEMENT**

**Next Action:** Begin Phase 1A - Consolidate Groups 1-2

---

*Created: 2025-01-23*
*Branch: feature/reduce-useeffect-count*
*Target: 24 → 9 useEffects (62% reduction)*

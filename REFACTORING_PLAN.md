# Refactoring Plan
## PEBL DataApp Code Quality Improvement

**Target:** Reduce technical debt, improve maintainability
**Priority:** HIGH (Blocking future development)
**Timeline:** 8 weeks (80 hours)
**Status:** Planning Phase

---

## Table of Contents
1. [Refactoring Priorities](#1-refactoring-priorities)
2. [page.tsx Decomposition](#2-pagetsx-decomposition-40-hours)
3. [Extract Business Logic to Hooks](#3-extract-business-logic-to-hooks-16-hours)
4. [Component Extraction](#4-component-extraction-12-hours)
5. [State Management Consolidation](#5-state-management-consolidation-8-hours)
6. [Performance Optimizations](#6-performance-optimizations-4-hours)
7. [Code Style & Consistency](#7-code-style--consistency-ongoing)

---

## 1. Refactoring Priorities

### Current Technical Debt

**Critical Issues:**
1. **Monolithic page.tsx** - 8,385 lines (HIGHEST PRIORITY)
2. **Prop drilling** - 70+ props to LeafletMap
3. **Duplicate logic** - 3 date parsers
4. **No code reuse** - Similar patterns repeated
5. **Large components** - PinChartDisplay (2000+ lines)

### Impact Assessment

| Issue | Impact on | Severity | Effort | Priority |
|-------|-----------|----------|--------|----------|
| page.tsx size | Maintainability | 🔴 Critical | 40h | P0 |
| Prop drilling | Performance | 🟡 Medium | 16h | P1 |
| Date parsers | Bugs | 🔴 High | 24h | P0 |
| Large components | Testing | 🟡 Medium | 12h | P2 |
| State management | Complexity | 🟡 Medium | 8h | P2 |

---

## 2. page.tsx Decomposition (40 hours)

### Current State Analysis

**File:** `src/app/map-drawing/page.tsx`
**Size:** 8,385 lines
**State Variables:** 60+ useState calls
**Functions:** 100+ functions
**Props Passed:** 70+ props to LeafletMap

### Problem Breakdown

```
page.tsx (8,385 lines)
├── State Management (500 lines)
│   ├── Map state (pins, lines, areas)
│   ├── UI state (dialogs, modes, selections)
│   ├── Project state
│   └── User state
├── Event Handlers (2,000 lines)
│   ├── Pin handlers (create, edit, delete)
│   ├── Line handlers
│   ├── Area handlers
│   ├── File handlers
│   └── Sharing handlers
├── Data Fetching (1,000 lines)
│   ├── Initial load
│   ├── Refresh logic
│   └── Real-time updates
├── Business Logic (1,500 lines)
│   ├── Validation
│   ├── Calculations
│   └── Transformations
├── JSX Rendering (2,000 lines)
│   └── Deeply nested components
└── Inline Styles & Utils (1,385 lines)
```

### Refactoring Strategy

#### Phase 1: Extract Feature Modules (Week 1-2, 16 hours)

**Create Feature-Specific Files:**

```
src/app/map-drawing/
├── page.tsx (reduced to ~500 lines)
├── features/
│   ├── pins/
│   │   ├── PinManager.tsx
│   │   ├── PinEditDialog.tsx
│   │   ├── PinListPanel.tsx
│   │   ├── usePinOperations.ts
│   │   └── pinUtils.ts
│   ├── lines/
│   │   ├── LineManager.tsx
│   │   ├── LineEditDialog.tsx
│   │   ├── useLineDrawing.ts
│   │   └── lineUtils.ts
│   ├── areas/
│   │   ├── AreaManager.tsx
│   │   ├── AreaEditDialog.tsx
│   │   ├── useAreaDrawing.ts
│   │   └── areaUtils.ts
│   ├── projects/
│   │   ├── ProjectManager.tsx
│   │   ├── ProjectSettingsDialog.tsx
│   │   ├── useProjectState.ts
│   │   └── projectUtils.ts
│   ├── sharing/
│   │   ├── SharingManager.tsx
│   │   ├── SharingDialog.tsx
│   │   └── useSharingOperations.ts
│   └── files/
│       ├── FileManager.tsx
│       ├── FileUploadDialog.tsx
│       └── useFileOperations.ts
└── components/
    ├── MapContainer.tsx
    ├── Sidebar.tsx
    ├── Toolbar.tsx
    └── StatusBar.tsx
```

**Step 1: Extract Pin Management (4 hours)**

```typescript
// src/app/map-drawing/features/pins/usePinOperations.ts
export function usePinOperations() {
  const { pins, setPins } = useMapData();
  const { toast } = useToast();

  const createPin = useCallback(async (pinData: PinInput) => {
    // All pin creation logic here
    try {
      const newPin = await mapDataService.createPin(pinData);
      setPins(prev => [...prev, newPin]);
      toast({ title: 'Pin created' });
      return newPin;
    } catch (error) {
      logger.error('Failed to create pin', error);
      toast({ variant: 'destructive', title: 'Failed to create pin' });
      throw error;
    }
  }, [pins, setPins, toast]);

  const updatePin = useCallback(async (id: string, updates: PinUpdate) => {
    // Update logic
  }, [pins, setPins]);

  const deletePin = useCallback(async (id: string) => {
    // Delete logic
  }, [pins, setPins]);

  return {
    createPin,
    updatePin,
    deletePin,
  };
}

// src/app/map-drawing/features/pins/PinManager.tsx
export function PinManager({ projectId }: Props) {
  const { createPin, updatePin, deletePin } = usePinOperations();
  const [editingPin, setEditingPin] = useState<Pin | null>(null);

  return (
    <>
      <PinList
        pins={pins}
        onEdit={setEditingPin}
        onDelete={deletePin}
      />
      {editingPin && (
        <PinEditDialog
          pin={editingPin}
          onSave={updatePin}
          onClose={() => setEditingPin(null)}
        />
      )}
    </>
  );
}
```

**Step 2: Extract Project Management (3 hours)**

```typescript
// src/app/map-drawing/features/projects/useProjectState.ts
export function useProjectState() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await projectService.getProjects();
    setProjects(data);
    if (data.length > 0) {
      setCurrentProject(data[0]);
    }
  };

  const switchProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      // Clear current data, load new project data
    }
  };

  return {
    currentProject,
    projects,
    switchProject,
    createProject: async (data: ProjectInput) => {
      const newProject = await projectService.createProject(data);
      setProjects(prev => [...prev, newProject]);
      return newProject;
    },
  };
}
```

**Step 3: Extract Drawing Tools (4 hours)**

```typescript
// src/app/map-drawing/features/lines/useLineDrawing.ts
export function useLineDrawing() {
  const [drawingMode, setDrawingMode] = useState<'none' | 'line' | 'area'>('none');
  const [lineStartPoint, setLineStartPoint] = useState<LatLng | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<LatLng | null>(null);

  const startLineDrawing = useCallback(() => {
    setDrawingMode('line');
  }, []);

  const handleMapClick = useCallback((latlng: LatLng) => {
    if (drawingMode === 'line') {
      if (!lineStartPoint) {
        setLineStartPoint(latlng);
      } else {
        // Complete line
        createLine(lineStartPoint, latlng);
        resetDrawing();
      }
    }
  }, [drawingMode, lineStartPoint]);

  const resetDrawing = () => {
    setDrawingMode('none');
    setLineStartPoint(null);
    setCurrentMousePosition(null);
  };

  return {
    drawingMode,
    lineStartPoint,
    currentMousePosition,
    startLineDrawing,
    handleMapClick,
    resetDrawing,
  };
}
```

**Step 4: Extract File Management (3 hours)**

**Step 5: Reconstruct page.tsx (2 hours)**

```typescript
// src/app/map-drawing/page.tsx (NEW, ~500 lines)
'use client';

import { MapContainer } from './components/MapContainer';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PinManager } from './features/pins/PinManager';
import { LineManager } from './features/lines/LineManager';
import { AreaManager } from './features/areas/AreaManager';
import { FileManager } from './features/files/FileManager';
import { useProjectState } from './features/projects/useProjectState';
import { useMapData } from '@/hooks/use-map-data';

export default function MapDrawingPage() {
  const { currentProject, projects, switchProject } = useProjectState();
  const { pins, lines, areas } = useMapData({ projectId: currentProject?.id });

  return (
    <div className="flex h-screen">
      <Sidebar
        projects={projects}
        currentProject={currentProject}
        onProjectSwitch={switchProject}
      />

      <div className="flex-1 relative">
        <Toolbar />

        <MapContainer
          pins={pins}
          lines={lines}
          areas={areas}
        />

        <PinManager projectId={currentProject?.id} />
        <LineManager projectId={currentProject?.id} />
        <AreaManager projectId={currentProject?.id} />
        <FileManager projectId={currentProject?.id} />
      </div>
    </div>
  );
}
```

#### Phase 2: Extract Shared Logic (Week 3-4, 12 hours)

**Create Shared Utilities:**

```typescript
// src/app/map-drawing/lib/coordinate-calculations.ts
export function calculateLineDistance(path: LatLng[]): number {
  // Extracted from page.tsx
}

export function calculatePolygonArea(path: LatLng[]): number {
  // Extracted from page.tsx
}

export function calculateCentroid(path: LatLng[]): LatLng {
  // Extracted from page.tsx
}

// src/app/map-drawing/lib/validation.ts
export function validatePinData(data: PinInput): ValidationResult {
  // Validation logic
}

export function validateLineData(data: LineInput): ValidationResult {
  // Validation logic
}

// src/app/map-drawing/lib/transformations.ts
export function transformDatabasePin(dbPin: DatabasePin): Pin {
  return {
    id: dbPin.id,
    lat: dbPin.lat,
    lng: dbPin.lng,
    label: dbPin.label,
    notes: dbPin.notes,
    color: dbPin.color,
    size: dbPin.size,
    objectVisible: dbPin.object_visible,
    labelVisible: dbPin.label_visible,
    createdAt: new Date(dbPin.created_at),
  };
}
```

#### Phase 3: State Management Refactor (Week 5, 12 hours)

**Option A: Context API (Recommended)**

```typescript
// src/app/map-drawing/context/MapContext.tsx
interface MapContextType {
  pins: Pin[];
  lines: Line[];
  areas: Area[];
  selectedPin: Pin | null;
  drawingMode: DrawingMode;
  // ... all map state
}

const MapContext = createContext<MapContextType | null>(null);

export function MapProvider({ children }: Props) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  // ... other state

  const value = useMemo(() => ({
    pins,
    lines,
    areas,
    setPins,
    setLines,
    setAreas,
    // ... methods
  }), [pins, lines, areas]);

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapContext must be within MapProvider');
  return context;
}
```

**Option B: Zustand (if Context re-renders become an issue)**

```typescript
// src/app/map-drawing/store/mapStore.ts
import { create } from 'zustand';

interface MapStore {
  pins: Pin[];
  lines: Line[];
  areas: Area[];
  addPin: (pin: Pin) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  deletePin: (id: string) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  pins: [],
  lines: [],
  areas: [],
  addPin: (pin) => set((state) => ({ pins: [...state.pins, pin] })),
  updatePin: (id, updates) =>
    set((state) => ({
      pins: state.pins.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  deletePin: (id) =>
    set((state) => ({ pins: state.pins.filter((p) => p.id !== id) })),
}));
```

---

## 3. Extract Business Logic to Hooks (16 hours)

### Custom Hooks to Create

**1. useMapView (4 hours)**
- Map center, zoom, bounds
- Viewport management
- Navigation history

**2. useDrawingTools (4 hours)**
- Drawing mode state
- Crosshair position
- Temporary shapes

**3. useTagManagement (3 hours)**
- Tag CRUD operations
- Tag assignment/removal
- Tag filtering

**4. useProjectVisibility (3 hours)**
- Object visibility toggles
- Batch visibility operations
- Project-level filters

**5. useFileSynchronization (2 hours)**
- localStorage sync
- Online/offline handling
- Conflict resolution

**Example Implementation:**

```typescript
// src/hooks/useDrawingTools.ts
export function useDrawingTools() {
  const [mode, setMode] = useState<DrawingMode>('none');
  const [tempShape, setTempShape] = useState<LatLng[]>([]);

  const startDrawing = (type: 'pin' | 'line' | 'area') => {
    setMode(type);
    setTempShape([]);
  };

  const addPoint = (latlng: LatLng) => {
    setTempShape(prev => [...prev, latlng]);
  };

  const finishDrawing = () => {
    const result = tempShape;
    setMode('none');
    setTempShape([]);
    return result;
  };

  const cancelDrawing = () => {
    setMode('none');
    setTempShape([]);
  };

  return {
    mode,
    tempShape,
    startDrawing,
    addPoint,
    finishDrawing,
    cancelDrawing,
    isDrawing: mode !== 'none',
  };
}
```

---

## 4. Component Extraction (12 hours)

### Large Components to Split

**PinChartDisplay.tsx (2000+ lines) → 6 hours**

Split into:
```
components/pin-data/
├── PinChartDisplay.tsx (main orchestrator, 300 lines)
├── chart-components/
│   ├── ChartHeader.tsx
│   ├── ChartControls.tsx
│   ├── ParameterSelector.tsx
│   ├── TimeAxisSelector.tsx
│   ├── MovingAverageControls.tsx
│   └── ChartVisualization.tsx
├── hooks/
│   ├── useChartData.ts
│   ├── useParameterSelection.ts
│   └── useChartFiltering.ts
└── utils/
    ├── chartDataTransform.ts
    └── chartExport.ts
```

**DataTimeline.tsx (1000+ lines) → 4 hours**

Split into:
```
components/pin-data/
├── DataTimeline.tsx (main, 200 lines)
├── timeline-components/
│   ├── TimelineHeader.tsx
│   ├── FileList.tsx
│   ├── MergePreview.tsx
│   └── FileActions.tsx
└── hooks/
    └── useTimelineData.ts
```

**LeafletMap.tsx (1412 lines) → 2 hours**

Already well-structured, but extract:
- Marker rendering → MarkerLayer.tsx
- Polyline rendering → PolylineLayer.tsx
- Polygon rendering → PolygonLayer.tsx

---

## 5. State Management Consolidation (8 hours)

### Current Issues

1. **60+ useState calls** in page.tsx
2. **No clear state ownership**
3. **Prop drilling nightmare**
4. **Difficult to track state changes**

### Solution: State Categorization

```typescript
// Group related state into custom hooks

// 1. Map State Hook
function useMapState() {
  return {
    pins: usePins(),
    lines: useLines(),
    areas: useAreas(),
    tags: useTags(),
  };
}

// 2. UI State Hook
function useUIState() {
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return {
    activeDialog,
    setActiveDialog,
    selectedItem,
    setSelectedItem,
    sidebarOpen,
    setSidebarOpen,
  };
}

// 3. User State Hook
function useUserState() {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({});

  return { user, preferences, updatePreferences: setPreferences };
}
```

### Implement Context for Global State

```typescript
// src/app/map-drawing/providers/AppProviders.tsx
export function AppProviders({ children }: Props) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <MapProvider>
          <UIProvider>
            {children}
          </UIProvider>
        </MapProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
```

---

## 6. Performance Optimizations (4 hours)

### Memoization Strategy

**1. Expensive Calculations (2 hours)**

```typescript
// BEFORE: Recalculates on every render
function MyComponent({ pins }) {
  const totalDistance = calculateTotalDistance(pins); // Expensive!
  return <div>{totalDistance}</div>;
}

// AFTER: Memoized
function MyComponent({ pins }) {
  const totalDistance = useMemo(
    () => calculateTotalDistance(pins),
    [pins]
  );
  return <div>{totalDistance}</div>;
}
```

**2. Callback Functions (1 hour)**

```typescript
// BEFORE: New function on every render
<Button onClick={() => handleClick(id)} />

// AFTER: Memoized callback
const handleClickMemo = useCallback(() => handleClick(id), [id]);
<Button onClick={handleClickMemo} />
```

**3. Component Memoization (1 hour)**

```typescript
// For components that render frequently but don't change often
export const PinMarker = React.memo(function PinMarker({ pin, onClick }: Props) {
  return (
    <Marker position={[pin.lat, pin.lng]} onClick={onClick}>
      <Popup>{pin.label}</Popup>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.pin.id === nextProps.pin.id &&
         prevProps.pin.lat === nextProps.pin.lat &&
         prevProps.pin.lng === nextProps.pin.lng;
});
```

### Lazy Loading

```typescript
// Lazy load heavy components
const PinChartDisplay = lazy(() => import('./PinChartDisplay'));
const MarinePlotsGrid = lazy(() => import('./MarinePlotsGrid'));

function DataDisplay() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <PinChartDisplay />
    </Suspense>
  );
}
```

---

## 7. Code Style & Consistency (Ongoing)

### Establish Patterns

**1. Component Structure**

```typescript
// Standard component template
import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  // Props with JSDoc
}

export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  const [state, setState] = useState();

  // 2. Derived state
  const computed = useMemo(() => {}, []);

  // 3. Effects
  useEffect(() => {}, []);

  // 4. Event handlers
  const handleClick = useCallback(() => {}, []);

  // 5. Render
  return <div>...</div>;
}
```

**2. Naming Conventions**

- Components: PascalCase (`PinManager.tsx`)
- Hooks: camelCase with `use` prefix (`usePinOperations.ts`)
- Utilities: camelCase (`calculateDistance.ts`)
- Constants: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- Types: PascalCase (`PinInput`, `ValidationResult`)

**3. File Organization**

```
feature/
├── FeatureComponent.tsx     (Main component)
├── FeatureDialog.tsx         (Dialog/modal)
├── FeatureList.tsx           (List view)
├── useFeatureOperations.ts   (Business logic hook)
├── featureUtils.ts           (Pure functions)
├── featureTypes.ts           (TypeScript types)
└── __tests__/
    └── FeatureComponent.test.tsx
```

---

## Execution Timeline

### Week-by-Week Breakdown

| Week | Task | Hours | Deliverable |
|------|------|-------|-------------|
| 1-2 | Extract pin/line/area features | 16 | 5 feature folders |
| 3 | Extract shared utilities | 6 | lib/ folder |
| 3-4 | State management refactor | 10 | Context providers |
| 5 | Custom hooks | 16 | 5 new hooks |
| 6 | Component splitting | 12 | Smaller components |
| 7 | Performance optimization | 8 | Memoization, lazy loading |
| 8 | Testing & documentation | 12 | Tests + docs |
| **Total** | | **80 hours** | Maintainable codebase |

### Success Metrics

**Before:**
- page.tsx: 8,385 lines
- Props to LeafletMap: 70+
- Largest component: 2,000+ lines
- Test coverage: 0%

**After:**
- page.tsx: <500 lines ✅
- Props to LeafletMap: <20 ✅
- Largest component: <500 lines ✅
- Test coverage: 60%+ ✅

---

## Risk Mitigation

### Testing Strategy

1. **Create tests before refactoring**
   - Ensures existing behavior preserved
   - Provides safety net

2. **Incremental refactoring**
   - One feature at a time
   - Can rollback easily

3. **Feature flags**
   - Toggle between old/new implementations
   - Gradual rollout

### Rollback Plan

```typescript
// Feature flag pattern
const USE_NEW_PIN_MANAGER = process.env.NEXT_PUBLIC_USE_NEW_PIN_MANAGER === 'true';

{USE_NEW_PIN_MANAGER ? (
  <PinManager />
) : (
  <OldPinLogic />
)}
```

---

## Next Steps

1. ✅ Create this refactoring plan
2. ⏳ Get stakeholder approval
3. ⏳ Create feature branch: `refactor/page-decomposition`
4. ⏳ Write tests for existing page.tsx behavior
5. ⏳ Begin Phase 1: Extract pin features
6. ⏳ Iterate through phases
7. ⏳ Code review & merge

---

**Document Status:** Complete
**Priority:** HIGH
**Blocking:** Testing, New Features, Onboarding
**Estimated Benefit:** 10x improvement in maintainability

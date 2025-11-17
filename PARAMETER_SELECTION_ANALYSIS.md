# Parameter Selection Logic - Comprehensive Analysis

## Overview
The parameter selection system manages which parameters (data series) are displayed in plots.
It is a multi-layered system with visibility state management, filtering, and plot rendering.

## 1. STATE MANAGEMENT

File: src/components/pin-data/PinChartDisplay.tsx, Lines 76-93

ParameterState Interface:
- visible: boolean (whether parameter is shown)
- color: string (hex color)
- opacity?: number (0-1 range)
- lineStyle?: 'solid' | 'dashed'
- lineWidth?: number (0.5-4)
- isSolo?: boolean (solo mode)
- timeFilter?: enabled, excludeStart, excludeEnd
- movingAverage?: enabled, windowDays, showLine

State initialization: Lines 454-471
- Creates parameterStates record mapping parameter names to ParameterState
- Default: First 4 parameters visible, rest hidden
- Colors converted from CSS variables to hex format

## 2. PARAMETER EXTRACTION

File: src/components/pin-data/PinChartDisplay.tsx

Lines 428-451: numericParameters extraction
- Gets all numeric columns from data
- Filters out 'time' and timeColumn
- Only includes columns with numeric values

Lines 546-549: visibleParameters computation
- Filters numericParameters by: parameterStates[param]?.visible == true
- This is used for chart Y-axis creation

Lines 612-621: allDisplayParameters
- Combines base parameters with MA (Moving Average) parameters
- Used for rendering lines in chart

## 3. PARAMETER VISIBILITY TOGGLE

File: src/components/pin-data/PinChartDisplay.tsx, Lines 1007-1015

toggleParameterVisibility Function:
```
const toggleParameterVisibility = (parameter: string) => {
  setParameterStates(prev => ({
    ...prev,
    [parameter]: {
      ...prev[parameter],
      visible: !prev[parameter]?.visible  // TOGGLE
    }
  }));
};
```

What happens when deselected (checkbox unchecked):
1. visible flag is set to false
2. Parameter removed from visibleParameters (via useMemo)
3. No Y-axis created for it in multi-axis mode
4. Line component still renders but won't display properly

## 4. PARAMETER SELECTION UI

File: src/components/pin-data/PinChartDisplay.tsx, Lines 2527-2900

Parameter Panel Header: Lines 2527-2553
- Collapse/expand button
- Shows "Parameters (X visible)" count

Parameter Filter Panel: Lines 2555-2572
- Shows filter options for 24hr style parameters
- Source, Unit, Date Range, Station filters

Parameter List Container: Lines 2576-2640
- Scrollable div (max height 210px)
- Filters displayed parameters based on active filters
- Maps over filteredParameters array

Filter Application Logic: Lines 2578-2615
1. Start with allDisplayParameters
2. Apply source filter if any selected
3. Apply date filter if any selected
4. Apply unit filter if any selected
5. Apply station filter if any selected
6. In minimal view: filter by visibility and sort

Rendering Each Parameter: Lines 2617-2900
- Maps over parametersToShow
- For each parameter:
  * Checkbox (hidden in minimal view) - LINE 2651: onCheckedChange={() => toggleParameterVisibility(parameter)}
  * Solo button - calls toggleSolo()
  * Parameter name with styling options

## 5. PLOT RENDERING

File: src/components/pin-data/PinChartDisplay.tsx

Single Axis Mode: Lines 2256-2308
- Maps over allDisplayParameters
- Creates Line component for each parameter
- Clicking line calls toggleParameterVisibility()
- Uses allDisplayParameters (NOT visibleParameters!)

Multi Axis Mode: Lines 2310-2490
- Creates one YAxis per visible parameter: visibleParameters.map()
- Right margin calculated from visible count
- Line components rendered from allDisplayParameters
- But without Y-axis, hidden parameters won't display

Key insight: Chart renders all parameters in allDisplayParameters, but only visible
ones get Y-axes, so hidden ones may not display properly.

## 6. PARENT NOTIFICATION (Merge Feature)

File: src/components/pin-data/PinChartDisplay.tsx, Lines 626-644

onVisibilityChange callback:
- Called when visibleParameters changes
- Sends: visibleParams array + paramColors record
- Used by merge feature to track which parameters are visible

Prop: onVisibilityChange?: (visibleParams: string[], paramColors: Record<string, string>) => void

## 7. PARAMETER FILTERING FLOW

All Data Points (raw CSV)
        |
        v
Extract numericParameters
        |
        v
Create parameterStates (visibility flags)
        |
        v
Filter by selected filters:
  - sourceFilter (e.g., "Porpoise")
  - dateFilter (e.g., "[2406_2407]")
  - unitFilter (e.g., "DPM")
  - stationFilter (e.g., "[C_S]")
        |
        v
In minimal view: Filter by visibility flag
        |
        v
Display in parameter list (parametersToShow)
        |
        v
Render in chart:
  - Single axis: allDisplayParameters.map() -> Line components
  - Multi axis: visibleParameters.map() -> YAxis, allDisplayParameters.map() -> Line

## 8. KEY FILES AND LOCATIONS

PinChartDisplay.tsx:
- Line 76-93: ParameterState interface
- Line 428-451: numericParameters extraction
- Line 454-471: State initialization
- Line 473-537: State updates on data change
- Line 546-549: visibleParameters computation
- Line 612-621: allDisplayParameters
- Line 1007-1015: toggleParameterVisibility function
- Line 2527-2900: Parameter panel UI
- Line 2647-2654: Checkbox for visibility
- Line 2578-2615: Filter application
- Line 2256-2308: Single axis rendering
- Line 2310-2490: Multi axis rendering
- Line 626-644: Parent visibility notification

ParameterFilterPanel.tsx:
- Line 139-145: toggleFilter function (multi-select)
- Line 56-133: Filter extraction logic

map-drawing/page.tsx:
- Line 4616: onVisibilityChange handler (merge feature)

## 9. DESELECTION BEHAVIOR

When user unchecks a parameter checkbox:
1. onCheckedChange() fires -> toggleParameterVisibility()
2. setParameterStates() sets visible: false
3. visibleParameters useMemo re-runs
4. Chart re-renders without Y-axis for that parameter
5. Parameter panel re-renders
6. Parent callback fires (if onVisibilityChange provided)

## 10. TWO TYPES OF PARAMETER FILTERING

Type 1: Visibility Toggle (checkbox)
- Controls parameterStates[param].visible
- Removes from visibleParameters
- Affects chart Y-axes

Type 2: Parameter Filters (Source/Unit/Date/Station)
- Filters which parameters appear in UI
- Does NOT affect chart rendering
- Only affects parameter selection panel

These are INDEPENDENT systems!


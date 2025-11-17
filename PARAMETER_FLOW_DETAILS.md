# Parameter Selection Flow Diagram

## Deselection Flow (What Happens When Checkbox Unchecked)

User clicks checkbox (UNCHECKED)
        |
        v
toggleParameterVisibility() called
        |
        v
setParameterStates() updates visible: false
        |
        v
visibleParameters useMemo re-runs (Line 546-549)
Filters out deselected parameter
        |
        v
Chart re-renders
  - Single axis: May still render line but hidden
  - Multi axis: No Y-axis created for hidden param
        |
        v
Parameter panel re-renders
Checkbox now shows as UNCHECKED
        |
        v
Parent callback fires (onVisibilityChange)
Notifies merge feature of change


## State Update Sequence

1. Initial State:
   parameterStates['Temperature'] = { visible: true, ... }
   visibleParameters = ['Temperature', 'Humidity']
   chart renders both

2. User unchecks Temperature checkbox:
   toggleParameterVisibility('Temperature')

3. State changes to:
   parameterStates['Temperature'] = { visible: false, ... }

4. visibleParameters useMemo updates:
   visibleParameters = ['Humidity']

5. Chart re-renders:
   - Single axis: Temperature line may render but hard to see
   - Multi axis: Temperature Y-axis not created
   - Lines iterate over allDisplayParameters
   - Temperature won't display properly

6. UI updates:
   - Checkbox shows unchecked
   - Parameter count updates: "(1 visible)"
   - Parent notified if onVisibilityChange provided


## Key Component Locations

1. Toggle Function:
   File: src/components/pin-data/PinChartDisplay.tsx
   Lines: 1007-1015
   Function: toggleParameterVisibility()

2. Visibility State:
   File: src/components/pin-data/PinChartDisplay.tsx
   Lines: 454-471, 546-549
   State: parameterStates, visibleParameters

3. UI Checkbox:
   File: src/components/pin-data/PinChartDisplay.tsx
   Lines: 2647-2654
   Handler: onCheckedChange={() => toggleParameterVisibility(parameter)}

4. Chart Rendering:
   File: src/components/pin-data/PinChartDisplay.tsx
   Single Axis: Lines 2256-2308
   Multi Axis: Lines 2310-2490

5. Filter Application:
   File: src/components/pin-data/PinChartDisplay.tsx
   Lines: 2578-2615
   Applies: source, date, unit, station filters


## Filter Priority

When displaying parameters in the list:

1. Start with: allDisplayParameters (all base + MA params)
2. Apply source filter (if any selected)
3. Apply date filter (if any selected)
4. Apply unit filter (if any selected)
5. Apply station filter (if any selected)
6. If minimal view: filter by visibility only
7. Result: parametersToShow

Each filter narrows the list. Empty filter = show all.


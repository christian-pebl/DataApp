# Static Analysis Summary

## TypeScript Type Errors
**Total Errors:** 67 type errors

### By File:
1. **mcp-servers/pin-sharing/src/index.ts**: 18 errors
   - Type assertion issues with Supabase query results
   - Missing properties on ParserError types

2. **src/app/map-drawing/page.tsx**: 44+ errors  
   - Leaflet type mismatches (LatLng vs L.LatLng)
   - Missing type definitions (Line, Area types)
   - Implicit 'any' types in callbacks
   - Property access errors

3. **src/app/data-explorer/page.tsx**: 1 error
   - Icon component type mismatch

### Severity Breakdown:
- **Critical (TS2304):** 2 - Cannot find name 'Line', 'setLines', 'setPins'
- **High (TS2339):** 16 - Property does not exist errors
- **Medium (TS2322, TS2345):** 30 - Type assignment mismatches
- **Low (TS7006):** 15 - Implicit 'any' type parameters

## ESLint
Configuration not set up - requires interactive setup

## Recommendation Priority:
1. Fix missing type imports (Line, Area)
2. Align Leaflet type definitions
3. Add proper typing to callbacks
4. Fix MCP server Supabase type assertions

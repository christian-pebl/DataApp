# Agent Hints — for Claude Code and Similar AI Agents

**Last Updated:** 2025-10-15
**Repository:** DataApp (Next.js Application)
**Purpose:** Guide AI agents for efficient codebase navigation and reasoning

---

## Overview

This repository is optimized for AI agent traversal and context loading. The codebase follows Next.js 15 App Router conventions with React Server and Client Components, Supabase for backend, and Leaflet/OpenLayers for maps.

**Start with these entry points for fastest context acquisition:**
- `/src/app/map-drawing/page.tsx` → Interactive map with drawing tools
- `/src/app/data-explorer/page.tsx` → Data visualization and file upload
- `/src/lib/supabase/` → Database services and API layer

---

## Quick Navigation

### Entry Points by Feature

**Map Features:**
- Main page: `src/app/map-drawing/page.tsx`
- Map component: `src/components/map/LeafletMap.tsx`
- Database service: `src/lib/supabase/map-data-service.ts`
- State hook: `src/hooks/use-map-data.ts`

**Data Visualization:**
- Explorer page: `src/app/data-explorer/page.tsx`
- Chart component: `src/components/pin-data/PinChartDisplay.tsx`
- CSV parser: `src/components/pin-data/csvParser.ts`
- File service: `src/lib/supabase/file-storage-service.ts`

**Authentication:**
- Client setup: `src/lib/supabase/client.ts`
- Server setup: `src/lib/supabase/server.ts`
- User UI: `src/components/auth/UserMenu.tsx`

**Sharing:**
- Share dialog: `src/components/sharing/ShareDialog.tsx`
- MCP server: `mcp-servers/pin-sharing/src/index.ts`

---

## Important Relationships

### Module Dependencies (What Depends on What)

```
app/map-drawing/page.tsx
├─ depends on → components/map/LeafletMap
├─ depends on → lib/supabase/map-data-service
├─ depends on → hooks/use-map-data
└─ depends on → components/pin-data/PinChartDisplay

components/map/LeafletMap
├─ depends on → leaflet (external)
├─ depends on → lib/coordinate-utils
└─ depends on → lib/geometry

components/pin-data/PinChartDisplay
├─ depends on → recharts (external)
├─ depends on → lib/dateParser
├─ depends on → lib/units
└─ depends on → lib/supabase/file-storage-service

lib/supabase/map-data-service
├─ depends on → @supabase/supabase-js (external)
└─ depends on → lib/supabase/client
```

### Reverse Dependencies (What Uses What)

```
leaflet
└─ used by → components/map/LeafletMap

ol (OpenLayers)
└─ used by → components/map/OpenLayersMap

lib/coordinate-utils
└─ used by → components/map/* (all map components)

lib/date Parser
└─ used by → components/pin-data/* (all chart components)

lib/supabase/map-data-service
├─ used by → app/map-drawing
├─ used by → hooks/use-map-data
└─ used by → components/map/LeafletMap
```

---

## Contextual Notes

### Code Organization

**DO load together** (frequently co-dependent):
- Map page + LeafletMap + map-data-service (map features)
- Data explorer + PinChartDisplay + file-storage-service (charts)
- Any component + lib/supabase/client (database access)

**DO NOT load together** (independent):
- `/legacy/` (isolated, avoid unless explicitly needed)
- `mcp-servers/` (independent Node.js services)
- Test files (when added, co-located with source)

### Architecture Boundaries

1. **Pages** (`app/`) - Entry points, orchestration only
2. **Components** (`components/`) - UI rendering, grouped by feature
3. **Services** (`lib/supabase/`) - Data access layer
4. **Utilities** (`lib/`) - Pure functions, no side effects
5. **Hooks** (`hooks/`) - React state and logic
6. **MCP Servers** (`mcp-servers/`) - Independent services

**Cross-boundary rules:**
- Pages can import components, hooks, services
- Components can import hooks, utilities, services
- Services can ONLY import utilities and Supabase client
- Utilities CANNOT import anything from src/
- Hooks can import services and utilities

### File Loading Strategy

**For map-related queries:**
1. Load `app/map-drawing/page.tsx` first (context)
2. Then `components/map/LeafletMap.tsx` (implementation)
3. Then `lib/supabase/map-data-service.ts` (data layer)
4. Optionally `hooks/use-map-data.ts` (state)

**For chart-related queries:**
1. Load `components/pin-data/PinChartDisplay.tsx` first
2. Then `lib/supabase/file-storage-service.ts` (data source)
3. Then `components/pin-data/csvParser.ts` (parsing logic)
4. Optionally `lib/dateParser.ts`, `lib/units.ts` (utilities)

**For database queries:**
1. Load `lib/supabase/` directory overview
2. Then specific service file (e.g., `map-data-service.ts`)
3. Then `lib/supabase/client.ts` for connection details

**For authentication queries:**
1. Load `lib/supabase/client.ts` first
2. Then `components/auth/UserMenu.tsx`
3. Then `lib/supabase/user-validation-service.ts` if needed

---

## Common Tasks & Where to Find Code

### "Where does X happen?"

| Task | Primary Location | Supporting Files |
|------|------------------|------------------|
| **Pin creation** | `lib/supabase/map-data-service.ts:createPin()` | `components/map/LeafletMap.tsx` |
| **Line drawing** | `components/map/LeafletMap.tsx` (useEffect line 425-583) | `lib/supabase/map-data-service.ts:createLine()` |
| **Area drawing** | `components/map/LeafletMap.tsx` (useEffect line 691-792) | `lib/supabase/map-data-service.ts:createArea()` |
| **CSV parsing** | `components/pin-data/csvParser.ts:parseCSV()` | `lib/dateParser.ts` |
| **File upload** | `lib/supabase/file-storage-service.ts:uploadCSVFile()` | Supabase Storage |
| **Chart rendering** | `components/pin-data/PinChartDisplay.tsx` | `recharts` library |
| **Data merging** | `components/pin-data/PinMergedPlot.tsx` | `lib/dateParser.ts` |
| **Date parsing** | `lib/dateParser.ts` | `date-fns` library |
| **Unit conversion** | `lib/units.ts` | Used by chart components |
| **Coordinate transform** | `lib/coordinate-utils.ts` | Used by map components |
| **Distance calculation** | `lib/geometry.ts` | Used for line/area calculations |
| **Authentication** | `lib/supabase/client.ts` | `@supabase/auth-ui-react` |
| **Real-time updates** | `hooks/use-map-data.ts` | Supabase real-time |
| **Map initialization** | `components/map/LeafletMap.tsx` (useEffect line 244-311) | `leaflet` library |

### "Which components use X?"

| Module | Direct Users |
|--------|--------------|
| **LeafletMap** | `app/map-drawing/page.tsx` |
| **OpenLayersMap** | `app/data-explorer/page.tsx` |
| **PinChartDisplay** | `app/map-drawing/page.tsx`, `components/pin-data/PinMarineDeviceData.tsx` |
| **csvParser** | `lib/supabase/file-storage-service.ts`, `app/data-explorer/page.tsx` |
| **map-data-service** | `app/map-drawing/page.tsx`, `hooks/use-map-data.ts`, `components/map/LeafletMap.tsx` |
| **file-storage-service** | `app/data-explorer/page.tsx`, `components/pin-data/*` |

---

## Data Flow Examples

### Pin Creation Flow

```
User clicks map (LeafletMap)
  ↓
LeafletMap onClick handler
  ↓
map-data-service.createPin({ lat, lng, label, ... })
  ↓
Supabase client.from('pins').insert()
  ↓
Database INSERT
  ↓
Supabase real-time event
  ↓
hooks/use-map-data subscription
  ↓
LeafletMap re-renders with new pin
```

**Files involved:**
1. `components/map/LeafletMap.tsx`
2. `lib/supabase/map-data-service.ts`
3. `hooks/use-map-data.ts`

### CSV Upload → Chart Display Flow

```
User uploads CSV file
  ↓
file-storage-service.uploadCSVFile(file)
  ↓
csvParser.parseCSV(file)
  ↓
Detect date formats + Parse rows
  ↓
Supabase Storage upload
  ↓
Database INSERT (file metadata)
  ↓
PinChartDisplay receives data
  ↓
Recharts renders chart
```

**Files involved:**
1. `lib/supabase/file-storage-service.ts`
2. `components/pin-data/csvParser.ts`
3. `lib/dateParser.ts`
4. `components/pin-data/PinChartDisplay.tsx`

---

## Known Issues & Technical Debt

### Critical Issues (Block Development)

1. **Monolithic page component** (`app/map-drawing/page.tsx`)
   - Size: 6,877 lines
   - Impact: Slow HMR, difficult to understand, hard to test
   - Status: Needs urgent refactoring (Epic 7)
   - Avoid: Adding more code here
   - Instead: Extract to separate components

2. **TypeScript errors** (67 total)
   - Files: `app/map-drawing/page.tsx` (44), `mcp-servers/pin-sharing/src/index.ts` (18)
   - Impact: Build fails
   - Status: In progress (Epic 1)
   - Note: May see type errors when loading these files

3. **No tests** (0% coverage)
   - Impact: Cannot safely refactor
   - Status: Test infrastructure being added (Epic 2)
   - Note: Assume all code is untested

### High Priority Issues

4. **Large chart components**
   - `PinChartDisplay.tsx`: 2,421 lines
   - `PinMergedPlot.tsx`: 1,399 lines
   - `PinMarineDeviceData.tsx`: 1,376 lines
   - Impact: Hard to maintain
   - Status: Planned for refactoring (Epic 8)

5. **LeafletMap complexity**
   - Size: 1,395 lines
   - Issues: 15 useEffect hooks, direct DOM manipulation
   - Impact: Difficult to debug
   - Status: Planned for refactoring (Epic 7.2)

6. **Debug code in production**
   - 457 console.log statements
   - Impact: Performance, information leakage
   - Status: Being removed (Epic 5)
   - Note: Ignore console.logs when analyzing

7. **Weak type safety**
   - 112 'any' type usages
   - 335 type assertions
   - Impact: Runtime errors possible
   - Status: Being improved (Epic 6)
   - Note: Don't trust types in older code

### Medium Priority

8. **Missing error boundaries**
   - Only 4 error boundaries in entire app
   - Impact: Errors crash entire app
   - Status: Planned (Epic 10)

9. **No React.memo usage**
   - Only 2 components use React.memo
   - Impact: Unnecessary re-renders
   - Status: Planned (Epic 9)

---

## Performance Notes

### Known Bottlenecks

1. **Large file HMR** - `map-drawing/page.tsx` takes 5-10s to hot reload
2. **Bundle size** - Currently ~3-4MB (target: <2MB)
3. **List re-renders** - Missing React.memo causes performance issues
4. **Map initialization** - Leaflet setup takes ~1-2s on mobile

### Optimization Opportunities

1. Code-split chart libraries (recharts)
2. Lazy load map components
3. Virtual scrolling for DataTimeline
4. Remove unused dependencies (firebase already removed)

---

## Testing Strategy (When Tests Added)

**Test locations:** Co-located with source files

```
src/lib/coordinate-utils.ts
src/lib/__tests__/coordinate-utils.test.ts  ← Test here

src/components/map/LeafletMap.tsx
src/components/map/__tests__/LeafletMap.test.tsx  ← Test here
```

**Test priorities:**
1. Utilities (pure functions) - Easy to test
2. Services (with mocked Supabase) - Critical paths
3. Hooks (with React Testing Library) - State logic
4. Components (with RTL) - User interactions

---

## Special Handling

### Dynamic Imports

**LeafletMap uses dynamic import to avoid SSR:**
```typescript
const LeafletMapWithNoSSR = dynamic(
  () => import('@/components/map/LeafletMap'),
  { ssr: false }
);
```

**Why:** Leaflet requires `window` object, not available during SSR

**Location:** `app/map-drawing/page.tsx`

### OpenLayers Mobile Optimization

**OpenLayersMap has custom touch handling:**
- Prevents default touch behaviors
- Distinguishes between taps and drags
- Quick tap (<300ms) = location select
- Long press/drag = map pan

**Location:** `components/map/OpenLayersMap.tsx`

### CSV Date Format Detection

**CSV parser auto-detects date formats:**
- Tries multiple formats: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, etc.
- Uses heuristics to guess format
- Falls back to ISO if detection fails

**Location:** `components/pin-data/csvParser.ts`, `lib/dateParser.ts`

### Marine Data Fetching

**External API integration:**
- Fetches marine/meteo data from external APIs
- Handles rate limiting
- Caches results

**Location:** `components/pin-data/PinMarineDeviceData.tsx`

---

## Avoid Loading These Unless Needed

- `/node_modules/` - Never load
- `/.next/` - Build artifacts
- `/mcp-servers/**/node_modules/` - MCP dependencies
- `**/*.backup` - Backup files (2 found)
- `/nul` - Temporary file
- `/.git/` - Git internals

---

## Example Agent Queries & Answers

**Q: "Where is data normalization implemented?"**
**A:** CSV normalization happens in:
1. `components/pin-data/csvParser.ts:parseCSV()` - Main parsing
2. `lib/dateParser.ts` - Date format detection and conversion
3. `lib/units.ts` - Unit conversions

**Q: "Which components touch sensor calibration?"**
**A:** No sensor calibration code found. Marine data is fetched from external APIs without calibration in:
- `components/pin-data/PinMarineDeviceData.tsx`

**Q: "What is the main async entrypoint for map rendering?"**
**A:** `src/components/map/LeafletMap.tsx` - Initialized in useEffect at line 244. Map instance created asynchronously after component mount.

**Q: "Where does CSV file upload occur?"**
**A:** File upload flow:
1. User selects file in `app/data-explorer/page.tsx`
2. Calls `lib/supabase/file-storage-service.ts:uploadCSVFile()`
3. Parses with `components/pin-data/csvParser.ts:parseCSV()`
4. Uploads to Supabase Storage
5. Inserts metadata to database

**Q: "Which functions handle authentication?"**
**A:**
- `lib/supabase/client.ts` - Supabase auth client setup
- `lib/supabase/server.ts` - Server-side auth
- `components/auth/UserMenu.tsx` - UI for login/logout
- `lib/supabase/user-validation-service.ts` - User validation logic

---

## Integration with Other Tools

### Supabase

**Connection:** `lib/supabase/client.ts` exports `supabase` client
**Usage:** All database operations go through this client
**Real-time:** Subscriptions in `hooks/use-map-data.ts`

### Recharts

**Usage:** All chart components use Recharts
**Main components:** `LineChart`, `ScatterChart`, `Tooltip`, `Brush`
**Location:** `components/pin-data/*`

### Leaflet

**Usage:** Primary map library for map-drawing
**Dynamic import:** To avoid SSR issues
**Location:** `components/map/LeafletMap.tsx`

### OpenLayers

**Usage:** Secondary map library for data-explorer
**Mobile-optimized:** Custom touch handling
**Location:** `components/map/OpenLayersMap.tsx`

### Radix UI

**Usage:** UI primitives (23 packages)
**Wrapped:** In `components/ui/` as shadcn/ui components
**Style:** Tailwind CSS

---

## Version Information

**Next.js:** 15.2.3 (App Router)
**React:** 18.3.1
**TypeScript:** 5.7.3
**Supabase:** 2.57.3
**Leaflet:** 1.9.4
**OpenLayers:** 9.2.4
**Recharts:** 2.15.1

**Last Review:** 2025-10-15
**Health Score:** 3.5/10 (Target: 8.5/10)

---

## For Future Agents

**This codebase is under active refactoring.** Expect:
- File structure changes (Epic 7, 8)
- Type improvements (Epic 6)
- Test additions (Epic 2)
- Navigation file updates (weekly)

**Regenerate semantic_map.json after:**
- Major refactorings
- New features added
- File moves/renames

**Update this file when:**
- Architecture changes
- New patterns introduced
- Critical files identified
- Known issues resolved

---

**Generated:** 2025-10-15
**Maintained by:** Autonomous Codebase Review System
**For questions:** See `docs/review/` for detailed reports

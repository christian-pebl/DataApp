# DataApp - Code Map

**Quick Reference for Navigating the Codebase**

Last Updated: 2025-10-15 | [Full Navigation Guide](./docs/ai_assist/agent_hints.md) | [Semantic Map (JSON)](./docs/index/semantic_map.json)

---

## 🗺️ Architecture Overview

```
DataApp/
├── src/
│   ├── app/                      # Next.js 15 App Router pages
│   │   ├── map-drawing/          # 📍 Interactive map (6,877 lines - REFACTORING)
│   │   ├── data-explorer/        # 📊 Data visualization
│   │   └── api/                  # API routes
│   │
│   ├── components/               # React components
│   │   ├── map/                  # 🗺️ Leaflet & OpenLayers maps
│   │   ├── pin-data/             # 📈 Charts and data viz
│   │   ├── sharing/              # 🔗 Share functionality
│   │   ├── auth/                 # 🔐 Authentication UI
│   │   ├── dataflow/             # 📊 Plot instances
│   │   └── ui/                   # 🎨 Radix UI primitives
│   │
│   ├── lib/                      # Utilities and services
│   │   ├── supabase/             # 💾 Database services
│   │   ├── coordinate-utils.ts   # 🌐 Coordinate transformations
│   │   ├── dateParser.ts         # 📅 Date parsing
│   │   ├── units.ts              # 📏 Unit conversions
│   │   └── geometry.ts           # 📐 Geometric calculations
│   │
│   └── hooks/                    # Custom React hooks
│       └── use-map-data.ts       # Map state management
│
├── mcp-servers/                  # MCP integrations
│   ├── pin-sharing/              # Sharing service
│   └── playwright-browser/       # Browser automation
│
└── docs/                         # Documentation
    ├── review/                   # Phase 1-3 reports
    ├── index/                    # Navigation files
    └── ai_assist/                # AI agent guides
```

---

## 🎯 Entry Points

| Feature | Start Here | Purpose |
|---------|------------|---------|
| **Map Drawing** | [`app/map-drawing/page.tsx`](./src/app/map-drawing/page.tsx) | Interactive map with pins, lines, areas |
| **Data Visualization** | [`app/data-explorer/page.tsx`](./src/app/data-explorer/page.tsx) | CSV upload and chart display |
| **Database Operations** | [`lib/supabase/`](./src/lib/supabase/) | All Supabase services |
| **Map Rendering** | [`components/map/LeafletMap.tsx`](./src/components/map/LeafletMap.tsx) | Core map component |
| **Chart Rendering** | [`components/pin-data/PinChartDisplay.tsx`](./src/components/pin-data/PinChartDisplay.tsx) | Time-series charts |

---

## 📦 Key Modules

### Core Features

#### 🗺️ Map System
- **Main Page:** `app/map-drawing/page.tsx` (6,877 lines - ⚠️ Needs refactoring)
- **Map Component:** `components/map/LeafletMap.tsx` (1,395 lines)
- **Data Service:** `lib/supabase/map-data-service.ts` (1,149 lines)
- **State Hook:** `hooks/use-map-data.ts` (696 lines)

**Functions:**
- Create pins, lines, areas
- Real-time collaboration
- Project management
- Drawing tools

#### 📊 Data Visualization
- **Charts:** `components/pin-data/PinChartDisplay.tsx` (2,421 lines - ⚠️ Needs refactoring)
- **Merged Plots:** `components/pin-data/PinMergedPlot.tsx` (1,399 lines)
- **Marine Data:** `components/pin-data/PinMarineDeviceData.tsx` (1,376 lines)
- **Timeline:** `components/pin-data/DataTimeline.tsx` (1,177 lines)
- **CSV Parser:** `components/pin-data/csvParser.ts` (613 lines)
- **File Service:** `lib/supabase/file-storage-service.ts` (765 lines)

**Functions:**
- CSV upload and parsing
- Time-series visualization
- Data merging
- Moving averages
- Time filtering

#### 🔗 Sharing
- **Share Dialog:** `components/sharing/ShareDialog.tsx` (605 lines)
- **Simplified Dialog:** `components/sharing/ShareDialogSimplified.tsx` (746 lines)
- **MCP Server:** `mcp-servers/pin-sharing/src/index.ts`

**Functions:**
- Share pins with users
- Public link generation
- Permission management
- Password protection

#### 🔐 Authentication
- **Client:** `lib/supabase/client.ts`
- **Server:** `lib/supabase/server.ts`
- **UI:** `components/auth/UserMenu.tsx` (464 lines)
- **Validation:** `lib/supabase/user-validation-service.ts`

---

## 🔍 Common Tasks

### "How do I...?"

| Task | Location | Key Functions |
|------|----------|---------------|
| **Create a pin** | `lib/supabase/map-data-service.ts` | `createPin()` |
| **Draw a line** | `components/map/LeafletMap.tsx` | useEffect (line 425), `createLine()` |
| **Draw an area** | `components/map/LeafletMap.tsx` | useEffect (line 691), `createArea()` |
| **Upload CSV** | `lib/supabase/file-storage-service.ts` | `uploadCSVFile()` |
| **Parse CSV** | `components/pin-data/csvParser.ts` | `parseCSV()` |
| **Render chart** | `components/pin-data/PinChartDisplay.tsx` | Component renders with Recharts |
| **Parse dates** | `lib/dateParser.ts` | `parseDate()`, `detectDateFormat()` |
| **Convert units** | `lib/units.ts` | `convertUnit()` |
| **Transform coordinates** | `lib/coordinate-utils.ts` | Utility functions |
| **Calculate distance** | `lib/geometry.ts` | Geometric utilities |
| **Authenticate** | `lib/supabase/client.ts` | Supabase auth |
| **Share a pin** | `components/sharing/ShareDialog.tsx` | Share UI + MCP server |

---

## 📊 Dependencies

### External Libraries

**Framework & Core:**
- Next.js 15.2.3 (App Router)
- React 18.3.1
- TypeScript 5.7.3

**Maps:**
- Leaflet 1.9.4 (primary)
- OpenLayers 9.2.4 (data explorer)

**Data & Charts:**
- Recharts 2.15.1
- date-fns 3.6.0
- d3-scale 4.0.2

**Backend:**
- Supabase 2.57.3
- PostgreSQL (via Supabase)

**UI:**
- Radix UI (23 packages)
- Tailwind CSS
- lucide-react (icons)

---

## ⚠️ Known Issues & Technical Debt

### 🔴 Critical

1. **Monolithic Page** - `app/map-drawing/page.tsx` (6,877 lines)
   - Status: Epic 7 (Refactoring in progress)

2. **TypeScript Errors** - 67 errors blocking build
   - Files: `app/map-drawing/page.tsx` (44), `mcp-servers/pin-sharing` (18)
   - Status: Epic 1 (Being fixed)

3. **Zero Test Coverage** - No tests exist
   - Status: Epic 2 (Test framework being added)

### 🟡 High Priority

4. **Large Components** - Several components >1,000 lines
   - PinChartDisplay (2,421), PinMergedPlot (1,399), LeafletMap (1,395)
   - Status: Epic 7-8 (Planned refactoring)

5. **Debug Code** - 457 console.log statements
   - Status: Epic 5 (Being removed)

6. **Type Safety** - 112 'any' types, 335 type assertions
   - Status: Epic 6 (Being improved)

---

## 🔗 Navigation Resources

**For AI Agents:**
- [`.clcode-index.yaml`](./.clcode-index.yaml) - Quick navigation config
- [`docs/index/semantic_map.json`](./docs/index/semantic_map.json) - Machine-readable structure
- [`docs/ai_assist/agent_hints.md`](./docs/ai_assist/agent_hints.md) - Detailed navigation guide

**For Developers:**
- [`docs/review/01_full_codebase_review.md`](./docs/review/01_full_codebase_review.md) - Comprehensive analysis
- [`docs/review/02_optimization_and_cleanup_plan.md`](./docs/review/02_optimization_and_cleanup_plan.md) - 12-epic refactoring plan
- [`docs/automation/run_log.md`](./docs/automation/run_log.md) - Change history

---

## 📈 Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Files** | 139 | - |
| **Lines of Code** | 35,649 | - |
| **Largest File** | 6,877 lines | <500 lines |
| **Test Coverage** | 0% | 70%+ |
| **TypeScript Errors** | 67 | 0 |
| **Bundle Size** | 3-4 MB | <2 MB |
| **Health Score** | 3.5/10 | 8.5/10 |

---

## 🚀 Active Development

**Current Phase:** Phase 3 - Implementation
**Epics in Progress:**
- Epic 1: Build stabilization (TypeScript errors)
- Epic 2: Test infrastructure setup
- Epic 3: Navigation foundation ✅ COMPLETE
- Epic 4: Dependency cleanup ✅ firebase removed

**Next Up:**
- Epic 5: Logging cleanup (457 console.logs)
- Epic 6: Type safety improvements
- Epic 7-8: Component refactoring (map & charts)

---

## 📞 Quick Reference

**Need to understand:**
- Map features → Start with `app/map-drawing/page.tsx`
- Charts → Start with `components/pin-data/PinChartDisplay.tsx`
- Database → Look in `lib/supabase/`
- Authentication → Check `lib/supabase/client.ts`

**Working on:**
- Maps → `components/map/` + `lib/supabase/map-data-service.ts`
- Data viz → `components/pin-data/` + `lib/supabase/file-storage-service.ts`
- UI → `components/ui/` (Radix primitives)

**Testing (coming soon):**
- Tests will be co-located with source files
- Structure: `src/lib/__tests__/utils.test.ts`

---

**Generated:** 2025-10-15 | **Status:** Active Development | **Health:** 3.5/10 → 8.5/10

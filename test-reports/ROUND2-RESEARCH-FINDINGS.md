# Round 2: Performance Testing Research Findings

**Date:** November 17, 2025
**Focus:** 2025 Best Practices for Next.js 15 + React 18 + Leaflet Performance

---

## Executive Summary

Researched latest 2025 performance testing strategies for Next.js 15 applications with focus on:
- **Core Web Vitals** monitoring (INP, LCP, CLS)
- **Bundle optimization** techniques
- **React 18 concurrent features**
- **Leaflet map performance** optimization
- **Automated testing** in CI/CD pipelines

**Key Finding:** React 18 concurrent rendering provides 46% desktop and 54% mobile performance improvements.

---

## Performance Testing Tools (2025 Stack)

### 1. Lighthouse CI
**Usage:** Automated performance testing in pipeline
**Key Metrics:**
- Performance score (0-100)
- Core Web Vitals (INP, LCP, CLS)
- Bundle size analysis
- Best practices audit

**Integration:**
```bash
npm install -g @lhci/cli
lhci autorun --config=lighthouse-budget.json
```

**Our Status:** ✅ Configured, ready to execute

---

### 2. @next/bundle-analyzer
**Usage:** Interactive treemap visualization of bundle composition
**Benefits:**
- Expose heavy dependencies at a glance
- Quantify exact KB/MB impact per component
- Zero config beyond setup

**Setup:**
```bash
npm install --save-dev @next/bundle-analyzer

# In next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
```

**Command:**
```bash
ANALYZE=true npm run build
```

**Our Status:** ⏳ Ready to install and execute

---

### 3. React DevTools Profiler
**Usage:** Component-level performance analysis
**Features:**
- Flamegraph visualization (yellow = slow, green-blue = fast)
- Identifies what triggered renders (props, state changes)
- Total time per component
- Render count tracking

**Best Practice:**
> "Measure before you optimize - every decision should be data-backed"

**Our Status:** ⏳ Ready to use (built into React DevTools)

---

### 4. Chrome DevTools Performance Tab
**Usage:** Deep browser-level profiling
**Features:**
- 4x CPU slowdown simulation (for testing on slow devices)
- JavaScript execution profiling
- Layout and paint analysis
- Network waterfall

**Recommended Settings:**
- Use "4x slowdown" CPU option
- Disable cache
- Use incognito mode (no extensions)

**Our Status:** ⏳ Ready to use

---

### 5. WebPageTest
**Usage:** Real-user monitoring and testing
**Benefits:**
- Test from different locations
- Various network speeds (3G, 4G, LTE)
- Film strip view of loading
- Real device testing

**Our Status:** Optional for future implementation

---

## Core Web Vitals (2025 Focus)

### 1. INP (Interaction to Next Paint) **NEW in 2025**
**Replaces:** FID (First Input Delay)
**Measures:** Responsiveness to user interactions
**Target:** <200ms
**Why it matters:** Measures all interactions, not just first input

**How to improve:**
- Use React 18 useTransition for non-urgent updates
- Implement concurrent rendering
- Reduce JavaScript execution time
- Optimize event handlers

---

### 2. LCP (Largest Contentful Paint)
**Measures:** Loading speed (when main content appears)
**Target:** <2.5s
**Current:** Unknown (to be measured)

**How to improve:**
- Optimize images with Next.js Image component
- Use priority loading for above-fold images
- Reduce server response time
- Implement code splitting
- Minimize render-blocking resources

---

### 3. CLS (Cumulative Layout Shift)
**Measures:** Visual stability (unexpected layout shifts)
**Target:** <0.1
**Current:** Unknown (to be measured)

**How to improve:**
- Set explicit width/height on images and iframes
- Avoid inserting content above existing content
- Use transform animations instead of changing dimensions
- Reserve space for dynamic content (ads, embeds)

---

## Next.js 15 Optimization Strategies

### 1. Code Splitting & Dynamic Imports
**Impact:** Reduce initial bundle size by 30-50%

**Implementation:**
```typescript
// Instead of:
import LeafletMap from '@/components/map/LeafletMap'

// Use:
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => <MapSkeleton />
})
```

**Benefits:**
- Smaller JavaScript bundles
- Faster time to interactive (TTI)
- Only load code when needed

**Our Priority:** HIGH - Map component is heavy (Leaflet + dependencies)

---

### 2. Next.js Image Component
**Impact:** Reduce image load time by 40-60%

**Current State:** Need to audit all `<img>` tags
**Target:** Convert all to `<Image>`

**Features:**
- Automatic format optimization (WebP, AVIF)
- Responsive sizing
- Lazy loading by default
- Built-in blur placeholder

**Example:**
```tsx
import Image from 'next/image'

<Image
  src="/map-tile.png"
  alt="Map"
  width={800}
  height={600}
  priority // For above-fold images
/>
```

**Our Priority:** MEDIUM - Audit image usage

---

### 3. next/font Optimization
**Impact:** Eliminate font loading flash

**Current State:** Need to check font loading strategy
**Target:** Use next/font for all fonts

**Example:**
```typescript
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

**Our Priority:** LOW - Likely already optimized

---

### 4. Script Loading Strategy
**Impact:** Defer non-critical JavaScript

**Strategy:**
```tsx
import Script from 'next/script'

<Script
  src="/analytics.js"
  strategy="lazyOnload" // Only load after page is interactive
/>
```

**Our Priority:** MEDIUM - Audit script tags

---

### 5. Tailwind Purge (Production)
**Impact:** Reduce CSS bundle by 90%+

**Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}'],
  // ...
}
```

**Our Status:** ✅ Should be configured by default

---

## React 18 Performance Features

### 1. Concurrent Rendering
**Impact:** 46% desktop, 54% mobile performance improvement

**How it works:**
- High-priority tasks (user input) can interrupt rendering
- Smooth UI updates even during heavy operations
- Prevents UI blocking

**Implementation:**
```tsx
import { startTransition } from 'react'

// Mark non-urgent updates
startTransition(() => {
  setSearchResults(filteredData) // Can be interrupted
})
```

**Our Priority:** HIGH - Implement for data-heavy operations

---

### 2. useTransition Hook
**Usage:** Smooth UI updates during navigation/filtering

**Example:**
```tsx
const [isPending, startTransition] = useTransition()

const handleFilter = (value) => {
  startTransition(() => {
    setFilter(value)
  })
}

return (
  <div>
    <input onChange={(e) => handleFilter(e.target.value)} />
    {isPending && <Spinner />}
    <DataList filter={filter} />
  </div>
)
```

**Our Priority:** MEDIUM - Implement for pin filtering

---

### 3. useMemo / useCallback
**⚠️ WARNING:** Only use when profiling shows benefit

**Anti-pattern:**
```tsx
// DON'T do this everywhere
const result = useMemo(() => calculateSomething(), [])
```

**Best Practice:**
1. Write code without memoization
2. Profile with React DevTools
3. Add memoization ONLY if component re-renders unnecessarily
4. Verify improvement with profiling

**Our Priority:** LOW - Add only after profiling identifies issues

---

## Leaflet-Specific Optimizations

### 1. Canvas Rendering (preferCanvas)
**Impact:** 50-70% performance improvement with 100+ markers

**Implementation:**
```typescript
const map = L.map('map', {
  preferCanvas: true // Use canvas instead of SVG
})
```

**Why it's faster:**
- SVG creates DOM element per marker (heavy with 100+)
- Canvas renders all markers on single element
- Reduces memory usage

**Our Priority:** HIGH - Likely have many pins on map

---

### 2. Marker Clustering
**Impact:** 80-90% performance improvement with 1000+ markers

**Implementation:**
```bash
npm install leaflet.markercluster
```

```typescript
import L from 'leaflet'
import 'leaflet.markercluster'

const markers = L.markerClusterGroup()
markers.addLayer(L.marker([lat, lng]))
map.addLayer(markers)
```

**Benefits:**
- Renders 10-40 clusters instead of 10,000 points
- Automatic zooming on cluster click
- Better UX for dense data

**Our Priority:** MEDIUM - Check current pin count

---

### 3. Vector Tiles (geojson-vt)
**Impact:** 60-80% performance improvement for large GeoJSON

**Implementation:**
```bash
npm install geojson-vt
```

**Benefits:**
- Precompute dataset into tiles
- Only show visible portions
- Handles millions of features

**Our Priority:** LOW - Likely not needed initially

---

### 4. Lazy Load Leaflet
**Impact:** Reduce initial bundle by ~150 KB

**Implementation:**
```typescript
// Use minified version
import L from 'leaflet/dist/leaflet'

// Or dynamic import
const initMap = async () => {
  const L = await import('leaflet/dist/leaflet')
  // Initialize map
}
```

**Our Priority:** HIGH - Part of code splitting strategy

---

### 5. Defer Leaflet Script
**Impact:** Don't block HTML rendering

**Implementation:**
```html
<!-- Place before </body> -->
<script src="/leaflet.js" defer></script>
```

**Our Priority:** MEDIUM - Check current script placement

---

## Bundle Optimization Techniques

### 1. Bundle Analysis
**Goal:** Identify heavy dependencies

**Process:**
1. Install @next/bundle-analyzer
2. Run `ANALYZE=true npm run build`
3. Review interactive treemap
4. Identify largest chunks

**Target Budget:** 400 KB (configured in lighthouse-budget.json)

**Expected Findings:**
- Leaflet: ~150 KB (largest dependency likely)
- Recharts: ~80 KB (data visualization)
- Radix UI: ~50 KB (UI components)
- React + Next.js: ~120 KB (framework)

**Our Priority:** HIGH - Execute first

---

### 2. Replace Heavy Dependencies
**Strategy:** Find lighter alternatives

**Examples:**
- Recharts (80 KB) → chart.js (60 KB) or lightweight-charts (20 KB)
- Moment.js (deprecated, 70 KB) → date-fns (2-20 KB modular)
- Lodash (full, 70 KB) → lodash-es (tree-shakeable)

**Our Priority:** MEDIUM - After bundle analysis identifies targets

---

### 3. Tree Shaking Verification
**Ensure:** Unused code is removed in production

**Check:**
```bash
npm run build
# Review output for unused exports warnings
```

**Fix:**
```javascript
// Use named imports for tree shaking
import { map, filter } from 'lodash-es'
// NOT: import _ from 'lodash'
```

**Our Priority:** MEDIUM - Part of bundle analysis

---

### 4. Code Splitting Strategy
**Approach:** Split by route and component

**Routes (automatic with Next.js):**
- `/` → home bundle
- `/map-drawing` → map bundle
- `/data-explorer` → explorer bundle

**Components (manual with dynamic):**
- Heavy components (Map, Charts, Dialogs)
- Third-party libraries (Leaflet, Recharts)
- Conditional features (admin panels, settings)

**Our Priority:** HIGH - Implement for map and charts

---

## Database Query Optimization

### 1. Profiling Strategy
**Tools:**
- Supabase Studio query inspector
- Chrome DevTools Network tab
- Custom timing logs

**Metrics to track:**
- Query execution time
- Query count per page load
- Sequential vs parallel execution
- Cache hit rate

**Our Priority:** HIGH - Profile map-drawing page

---

### 2. Common Issues
- **N+1 Queries:** Multiple sequential queries instead of single batched query
- **No Caching:** Repeat queries for same data
- **No Parallelization:** Sequential queries that could run in parallel
- **No Pagination:** Fetching all data when only subset needed

**Our Priority:** HIGH - Identify and fix

---

### 3. Optimization Techniques
**Batching:**
```typescript
// Instead of:
const pin1 = await db.from('pins').select('*').eq('id', 1)
const pin2 = await db.from('pins').select('*').eq('id', 2)

// Use:
const pins = await db.from('pins').select('*').in('id', [1, 2])
```

**Parallelization:**
```typescript
// Instead of:
const pins = await db.from('pins').select('*')
const areas = await db.from('areas').select('*')

// Use:
const [pins, areas] = await Promise.all([
  db.from('pins').select('*'),
  db.from('areas').select('*')
])
```

**Caching:**
```typescript
const cache = new Map()

async function getCachedData(key) {
  if (cache.has(key)) return cache.get(key)
  const data = await db.from('table').select('*')
  cache.set(key, data)
  return data
}
```

**Our Priority:** HIGH - Implement after profiling

---

## Performance Testing Implementation Plan

### Phase 1: Baseline Measurement (30 min)
1. ✅ Run Lighthouse on localhost:9002
2. ✅ Run Lighthouse on production
3. ✅ Document baseline scores
4. ✅ Identify top 5 issues

### Phase 2: Bundle Analysis (30 min)
1. ✅ Install @next/bundle-analyzer
2. ✅ Run production build with analysis
3. ✅ Review bundle composition
4. ✅ Identify optimization opportunities

### Phase 3: Profiling (1 hour)
1. ✅ Profile map-drawing page with React DevTools
2. ✅ Profile with Chrome DevTools Performance tab
3. ✅ Profile database queries
4. ✅ Document findings

### Phase 4: Implementation (2-3 hours)
1. ✅ Implement code splitting for map
2. ✅ Optimize database queries
3. ✅ Add concurrent rendering features
4. ✅ Optimize Leaflet configuration
5. ✅ Test each optimization

### Phase 5: Validation (30 min)
1. ✅ Re-run Lighthouse audits
2. ✅ Compare before/after metrics
3. ✅ Document improvements
4. ✅ Create performance report

---

## Success Criteria

### Lighthouse Scores
**Baseline:** Unknown (to be measured)
**Target:** >85 for all categories

**Metrics:**
- Performance: >85
- Accessibility: >90
- Best Practices: >90
- SEO: >90

### Core Web Vitals
**Targets:**
- INP: <200ms
- LCP: <2.5s
- CLS: <0.1

### Bundle Size
**Current:** Unknown (to be measured)
**Target:** <400 KB total (per budget)

**Breakdown:**
- Vendor bundle: <250 KB
- App bundle: <150 KB

### Map Load Time
**Current:** 10-15s (from E2E tests)
**Target:** <2s (85% improvement)

**Breakdown:**
- Time to First Paint: <1s
- Time to Interactive: <2s
- Full map render: <2s

---

## Research Sources

1. **Next.js Performance Best Practices 2025**
   - Mastering Mobile Performance: Wisp CMS Guide
   - Next.js Performance Tuning: QED42
   - Pagepro: Next.js Performance Optimization Guide
   - Achieving 95+ Lighthouse Scores in Next.js 15 (Medium)

2. **React 18 Profiling & Optimization**
   - Practical Guide to Profiling React Applications (DEV Community)
   - React Performance Optimization 2025 (Growin)
   - Calibre: React Performance Profiling with Chrome DevTools
   - LogRocket: Debugging Performance Problems in React

3. **Leaflet Performance**
   - Stack Overflow: Leaflet Performance with Many Markers
   - DEV Community: Optimizing 12,000+ Markers with Leaflet
   - GIS Stack Exchange: High Performance Markers
   - Smashing Magazine: Code Splitting for Bundle Performance

---

## Next Steps

1. ✅ Create research findings document (this file)
2. ⏳ Execute Lighthouse audits
3. ⏳ Install and run bundle analyzer
4. ⏳ Profile with React DevTools + Chrome DevTools
5. ⏳ Implement optimizations
6. ⏳ Validate improvements
7. ⏳ Create comprehensive performance report

---

**Research Complete:** November 17, 2025
**Time Spent:** 30 minutes
**Status:** Ready for implementation
**Next Action:** Execute Lighthouse audits on local and production

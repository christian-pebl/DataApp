# Additional App Loading Optimizations

**Status:** Recommendations
**Date:** 2025-10-15

## Current State (After Priority 1 Optimizations)

✅ **Completed:**
- Removed OpenLayers (~600KB)
- Removed Firebase/Genkit (~400KB+)
- Smart webpack chunk splitting
- Tree-shaking for lucide-react, recharts, date-fns
- SWC minification enabled
- Console.log removal in production
- Source maps disabled
- Modern image formats (AVIF, WebP)
- Font optimization with Next.js

**Result:** ~40-50% load time reduction

---

## 🚀 Priority 2 Optimizations (Quick Wins)

### 1. **Lazy Load Dialog Components** ⚡
**Impact:** Medium (50-100KB initial bundle reduction)
**Effort:** Low (1-2 hours)

Many dialogs are imported statically but only used on user interaction:

**Files to optimize:**
```typescript
// src/components/data-explorer/FileActionsDialog.tsx
// Currently imports OutlierCleanupDialog statically
import { OutlierCleanupDialog } from './OutlierCleanupDialog';

// Change to:
const OutlierCleanupDialog = dynamic(() =>
  import('./OutlierCleanupDialog').then(mod => ({ default: mod.OutlierCleanupDialog })),
  { ssr: false }
);
```

**Other candidates:**
- `StylingRulesDialog` - Only used when user clicks styling button
- `MergeFilesDialog` - Only used for file merging
- `MultiFileConfirmDialog` - Only used for multi-file operations
- All dialog components in data-explorer and pin-data folders

**Implementation:**
```typescript
// Pattern for all dialogs
const [DialogComponent] = dynamic(() => import('./DialogName'), {
  ssr: false,
  loading: () => <div className="animate-pulse">Loading...</div>
});
```

---

### 2. **Lazy Load PapaParse** ⚡
**Impact:** Medium (~50KB)
**Effort:** Low (30 minutes)

PapaParse is only used when:
- Parsing CSV files in outlier cleanup
- Merging files
- File upload processing

**Current usage:**
```typescript
// src/app/data-explorer/actions.ts
import Papa from 'papaparse';
```

**Optimize to:**
```typescript
// Only import when needed
const Papa = (await import('papaparse')).default;
```

Already done in some places, ensure consistency across:
- ✅ `actions.ts` (already using dynamic import)
- ❌ `multiFileValidator.ts` (static import)
- ❌ Any other CSV parsing locations

---

### 3. **Optimize Recharts Imports** ⚡⚡
**Impact:** High (~100-150KB)
**Effort:** Medium (2-3 hours)

Recharts is heavy. Current usage analysis:

**Files using Recharts:**
- `PinChartDisplay.tsx`
- `PinMarineMeteoPlot.tsx`
- `MarinePlotsGrid.tsx`
- `OutlierCleanupDialog.tsx`
- `HeatmapDisplay.tsx`

**Optimization strategies:**

**A. Use specific imports instead of barrel imports:**
```typescript
// ❌ Bad (imports entire library)
import { LineChart, Line, XAxis, YAxis } from 'recharts';

// ✅ Better (tree-shakeable)
import { LineChart } from 'recharts/lib/chart/LineChart';
import { Line } from 'recharts/lib/cartesian/Line';
```

**B. Lazy load charts that aren't immediately visible:**
```typescript
// For OutlierCleanupDialog scatter plots
const ScatterChart = dynamic(() =>
  import('recharts').then(mod => ({ default: mod.ScatterChart })),
  { ssr: false }
);
```

**C. Consider alternative lightweight charting:**
- For simple line charts: Consider `chart.js` or native SVG
- For scatter plots only: Custom D3 implementation
- Keep Recharts only for complex multi-axis plots

---

### 4. **Font Loading Optimization** ⚡
**Impact:** Low-Medium (~20-30KB)
**Effort:** Low (1 hour)

**Current state:**
```typescript
// layout.tsx
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'], // ← Loading 4 weights
  style: ['normal', 'italic'],          // ← Loading 2 styles
  variable: '--font-roboto',
});
```

**Optimize:**
```typescript
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500'], // Only most used weights
  style: ['normal'],      // Only normal (load italic on-demand)
  variable: '--font-roboto',
  display: 'swap',        // Show fallback immediately
  preload: true,
});
```

**Audit font usage:**
```bash
# Check actual usage
grep -r "font-weight: 300" src/
grep -r "font-weight: 700" src/
grep -r "italic" src/
```

Remove unused weights to save ~5-10KB per weight.

---

### 5. **CSS Purging & Critical CSS** ⚡
**Impact:** Medium (~30-50KB)
**Effort:** Medium (2 hours)

**A. Enable Tailwind JIT purging:**
```typescript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    // Be specific to avoid unused classes
  ],
  // Remove unused CSS
  safelist: [], // Only add truly dynamic classes
}
```

**B. Extract critical CSS:**
Use Next.js `_document.tsx` to inline critical CSS for first paint.

**C. Remove unused custom CSS:**
Audit `globals.css` for unused classes:
- Debug styles (lines 204-226) - Already commented out ✅
- Check if all tooltip styles are needed
- Consolidate duplicate z-index rules

---

### 6. **Image Optimization** ⚡
**Impact:** Variable (depends on images)
**Effort:** Low (1 hour)

**Current logos:**
```typescript
// layout.tsx
icons: {
  icon: '/logos/PEBL Logo-3.svg',
  apple: '/logos/PEBL Logo-3.svg',
},
```

**Optimize:**
- Minify SVG files with SVGO
- Consider inlining small SVGs (<2KB) directly in code
- Use `<Image>` component for raster images

**Check logo file sizes:**
```bash
ls -lh public/logos/
```

**Minify SVGs:**
```bash
npx svgo -f public/logos -o public/logos
```

---

### 7. **Component Code Splitting** ⚡⚡
**Impact:** High (~100-200KB)
**Effort:** Medium (3-4 hours)

**Heavy components to split:**

**A. Chart components:**
```typescript
// src/components/pin-data/PinChartDisplay.tsx
// Split into separate routes or lazy load
const ChartDisplay = dynamic(() => import('./PinChartDisplay'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false
});
```

**B. Map components:**
Already using dynamic imports ✅ (LeafletMap, DataExplorerMap)

**C. Large feature dialogs:**
- StylingRulesDialog
- MergeFilesDialog
- OutlierCleanupDialog (already created, needs lazy loading)

---

### 8. **Remove Unused Dependencies** ⚡
**Impact:** Medium (~50-100KB)
**Effort:** Low (1 hour)

**Audit dependencies:**
```bash
npx depcheck
```

**Known potentially unused:**
- `@tanstack/react-query` - Check if actually used
- `sonner` - Check if duplicating toast functionality
- `uuid` - Check if can use crypto.randomUUID()
- `pg` - Should this be in devDependencies?
- `node-fetch` - Native fetch available in Node 18+
- `bcryptjs` - Only needed server-side, ensure not bundled client-side

**Check bundle analyzer:**
```bash
npm install -D @next/bundle-analyzer

# next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run
ANALYZE=true npm run build
```

---

### 9. **API Route Optimization** ⚡
**Impact:** Low (better perceived performance)
**Effort:** Low (1 hour)

**Add loading states for all data fetches:**
- OutlierCleanupDialog - Already has loading state ✅
- FileActionsDialog - Already has loading state ✅
- Data Explorer file list - Add skeleton loaders
- Marine data fetch - Already has loading state ✅

**Stream large API responses:**
```typescript
// For large CSV files
export async function GET() {
  const stream = new ReadableStream({...});
  return new Response(stream);
}
```

---

### 10. **Service Worker for Static Assets** ⚡⚡
**Impact:** High (instant repeat loads)
**Effort:** High (4-6 hours)

**Implement PWA caching:**
```typescript
// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
```

**Cache strategy:**
- Static assets: Cache first
- API responses: Network first, cache fallback
- Images: Cache with expiration

---

## 🎯 Priority 3 Optimizations (Advanced)

### 11. **React Server Components**
Convert static components to RSC to reduce client bundle:
- Layout components
- Navigation
- Static cards/info displays

### 12. **Incremental Static Regeneration (ISR)**
For pages with infrequent updates:
- Landing page
- Documentation
- Static marketing content

### 13. **Edge Runtime for API Routes**
Move lightweight API routes to edge:
```typescript
export const runtime = 'edge';
```

### 14. **Database Query Optimization**
- Add indexes on frequently queried columns
- Use RLS policies efficiently
- Implement query result caching

---

## 📊 Measurement & Monitoring

### Before Starting:
```bash
# Measure current bundle size
npm run build
# Note sizes from output

# Lighthouse audit
npx lighthouse http://localhost:9002 --view
```

### Tools to Use:
- **Bundle Analyzer:** `@next/bundle-analyzer`
- **Lighthouse:** Chrome DevTools
- **Web Vitals:** Next.js built-in
- **Webpack Bundle Analyzer:** Visualize chunk sizes

### Target Metrics:
- **LCP (Largest Contentful Paint):** <2.5s
- **FID (First Input Delay):** <100ms
- **CLS (Cumulative Layout Shift):** <0.1
- **Total Bundle Size:** <500KB initial load

---

## 🏆 Recommended Implementation Order

### Week 1 (Quick Wins):
1. ✅ Lazy load all dialog components (4 hours)
2. ✅ Optimize Recharts imports (3 hours)
3. ✅ Font weight optimization (1 hour)
4. ✅ PapaParse consistency check (30 min)

**Expected Savings:** ~150-200KB, 15-20% load time improvement

### Week 2 (Medium Impact):
5. ✅ Remove unused dependencies (2 hours)
6. ✅ Component code splitting (4 hours)
7. ✅ CSS optimization (2 hours)
8. ✅ Image optimization (1 hour)

**Expected Savings:** ~100-150KB, 10-15% load time improvement

### Week 3 (Advanced):
9. ✅ Service Worker + PWA (6 hours)
10. ✅ API route optimization (3 hours)
11. ✅ React Server Components migration (6 hours)

**Expected Savings:** Repeat visits near-instant, 30-40% perceived improvement

---

## 🧪 Testing Checklist

After each optimization:
- [ ] Run `npm run build` and compare bundle sizes
- [ ] Test in Chrome DevTools Network tab (Slow 3G)
- [ ] Run Lighthouse audit
- [ ] Test on actual mobile device
- [ ] Verify all features still work
- [ ] Check for console errors
- [ ] Test with React DevTools Profiler

---

## 📝 Notes

- **Don't over-optimize:** Balance bundle size with code maintainability
- **Measure everything:** Use data to prioritize optimizations
- **Test thoroughly:** Performance optimizations can break features
- **Consider hosting:** Optimize server response times too
- **Monitor production:** Set up Real User Monitoring (RUM)

---

## 🔗 Resources

- [Next.js Optimization Docs](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev Performance](https://web.dev/performance/)
- [Bundle Analysis Guide](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [Lighthouse Guide](https://developer.chrome.com/docs/lighthouse/)

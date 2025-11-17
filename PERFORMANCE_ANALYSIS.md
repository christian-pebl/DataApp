# Performance Analysis & Optimization Recommendations

**Date**: October 15, 2025
**Analyst**: Performance Testing Suite
**App**: PEBL Ocean Data Platform

---

## Executive Summary

The app currently has **significant opportunities for optimization**. While development mode shows acceptable load times (~600-800ms), the production bundle sizes are concerning with several chunks exceeding 300KB. The total build directory is **340MB**, indicating substantial room for optimization.

---

## Current Performance Metrics

### Load Times (Development Mode - Turbopack)
- **Homepage**: ~617ms total load time
  - DOM Interactive: 103ms
  - First Contentful Paint: 112ms
- **Map Drawing Page**: ~630ms total load time
  - DOM Interactive: 123ms
  - First Contentful Paint: 132ms

**Note**: Production builds will likely be slower due to larger bundle sizes and network transfer times.

### Bundle Analysis

#### Largest Chunks (Production Build)
1. **2012-669cfea243bf2a3b.js**: 544 KB ⚠️ CRITICAL
2. **map-drawing/page-6c5259cbcc877c70.js**: 337 KB ⚠️ HIGH
3. **6147.c39ed053d1f8e0f7.js**: 304 KB ⚠️ HIGH
4. **src_components_pin-data_e7dde7fd._.js**: 304 KB ⚠️ HIGH
5. **1684-792f5d1a0bd5784e.js**: 172 KB
6. **4bd1b696-3c30bd92f1b29839.js**: 168 KB
7. **2908-e788ec46254fc41a.js**: 156 KB
8. **framework-2c2be674e67eda3d.js**: 140 KB (React framework)

**Total Critical Bundle Size**: ~1.8 MB across largest chunks alone

#### Build Directory Size
- **Total**: 340 MB (includes source maps, dev assets, etc.)

### Heavy Dependencies Identified
- **recharts**: Used in 13 files (chart library ~200KB gzipped)
- **leaflet**: Used in 4 map components (~150KB)
- **@radix-ui**: 17+ separate packages (~300KB+ total)
- **lucide-react**: 33+ icons imported in single file
- **date-fns**: Used extensively across app
- **firebase**: Large SDK (~400KB+)
- **ol** (OpenLayers): Alternative map library (~600KB)
- **papaparse**: CSV parsing (~50KB)

---

## Critical Performance Issues

### 🔴 Issue #1: Massive Icon Imports
**Location**: `src/app/map-drawing/page.tsx:11`

```typescript
// CURRENT - imports 33+ icons in one line!
import { Loader2, MapPin, Minus, Square, Home, RotateCcw, Save, Trash2, Navigation,
  Settings, Plus, ZoomIn, ZoomOut, Map as MapIcon, Crosshair, FolderOpen,
  Bookmark, Eye, EyeOff, Target, Menu, ChevronDown, ChevronRight, Info,
  Edit3, Check, Database, BarChart3, Upload, Cloud, Calendar, RotateCw,
  Share, Share2, Users, Lock, Globe, X, Search, CheckCircle2, XCircle,
  ChevronUp, Thermometer, Wind as WindIcon, CloudSun, Compass as CompassIcon,
  Waves, Sailboat, Timer as TimerIcon, Sun as SunIcon, AlertCircle,
  Move3D, Copy, FileCode } from 'lucide-react';
```

**Impact**: While tree-shaking helps, this pattern increases:
- Initial parse time
- Bundle analyzer complexity
- Maintenance difficulty

**Solution**: Create a centralized icons barrel export or use dynamic imports for rarely-used icons.

---

### 🔴 Issue #2: Recharts Bundle Size
**Locations**: 13 files import recharts

Recharts is a heavyweight library (~200KB gzipped) that includes:
- D3 dependencies
- Multiple chart types
- Animation libraries

**Impact**:
- Large initial bundle
- Unused chart types still bundled
- Multiple imports across components

**Solutions**:
1. Consider lighter alternatives:
   - **Chart.js** (~60KB gzipped)
   - **uPlot** (~45KB gzipped)
   - **Visx** (more modular)
2. Code-split charts into separate route chunks
3. Lazy load charts only when needed

---

### 🔴 Issue #3: Dual Map Libraries
**Finding**: Both **Leaflet** (~150KB) and **OpenLayers** (~600KB) are in dependencies

```json
"leaflet": "^1.9.4",
"ol": "^9.2.4"
```

**Impact**:
- ~750KB of map libraries
- Likely only one is actively used
- Duplicated functionality

**Solution**: Choose ONE map library and remove the other. Recommended: Keep Leaflet (lighter, simpler) unless OpenLayers features are essential.

---

### 🔴 Issue #4: Firebase SDK Size
**Location**: `package.json`

```json
"firebase": "^11.7.3"
```

**Impact**: Firebase SDK is very large (~400KB+). If only using specific features (auth, firestore), use modular imports.

**Current**:
```typescript
import firebase from 'firebase';
```

**Better**:
```typescript
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
```

---

### 🟡 Issue #5: No Code Splitting for Heavy Routes
**Finding**: Large page components not split properly

The map-drawing page (337KB) loads everything at once:
- All UI components
- All chart libraries
- All map utilities
- Marine data components

**Solution**: Implement route-based and component-based code splitting.

---

### 🟡 Issue #6: Missing Production Optimizations
**Next.js Config**: `next.config.ts`

Currently minimal config:
```typescript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true }
```

**Missing**:
- SWC minification
- Image optimization
- Compression
- Bundle analyzer
- Experimental features

---

## Optimization Recommendations

### Priority 1: Critical (Immediate Impact)

#### 1.1 Remove Unused Map Library
**Effort**: Low | **Impact**: High (~600KB savings)

```bash
# If using Leaflet:
npm uninstall ol

# If using OpenLayers:
npm uninstall leaflet react-leaflet
```

**Expected Savings**: 600KB (OpenLayers) or 150KB (Leaflet)
**Load Time Improvement**: ~300-600ms (on 3G)

---

#### 1.2 Optimize Firebase Imports
**Effort**: Medium | **Impact**: High (~200-300KB savings)

Replace full Firebase SDK with modular imports:

```typescript
// Before
import firebase from 'firebase';

// After
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
```

**Expected Savings**: 200-300KB
**Load Time Improvement**: ~200-400ms (on 3G)

---

#### 1.3 Lazy Load Recharts
**Effort**: Medium | **Impact**: High (~200KB initial load reduction)

Wrap chart components with dynamic imports:

```typescript
// In components using charts
const ChartComponent = dynamic(
  () => import('./ChartComponent'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
);
```

**Expected Savings**: 200KB from initial bundle
**Load Time Improvement**: ~300-500ms FCP improvement

---

#### 1.4 Implement Route-Based Code Splitting
**Effort**: Low | **Impact**: Medium

Next.js already does this, but ensure heavy components use dynamic imports:

```typescript
// Heavy components in map-drawing/page.tsx
const MarinePlotsGrid = dynamic(
  () => import('@/components/marine/MarinePlotsGrid'),
  { loading: () => <Loader /> }
);

const PinChartDisplay = dynamic(
  () => import('@/components/pin-data/PinChartDisplay'),
  { loading: () => <Loader /> }
);
```

**Expected Savings**: 150-200KB from initial bundle
**Load Time Improvement**: ~200-300ms

---

### Priority 2: High Impact (Quick Wins)

#### 2.1 Optimize Icon Imports
**Effort**: Low | **Impact**: Medium

Create icon barrel export:

```typescript
// src/lib/icons.ts
export {
  Loader2,
  MapPin,
  Save,
  // ... only frequently used icons
} from 'lucide-react';

// For rarely used icons, use dynamic import:
export const RareIcon = dynamic(() =>
  import('lucide-react').then(mod => ({ default: mod.RareIconName }))
);
```

**Expected Savings**: 20-30KB
**Maintenance**: Much easier to manage

---

#### 2.2 Enable Next.js Production Optimizations
**Effort**: Low | **Impact**: Medium

Update `next.config.ts`:

```typescript
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Fix types properly
  },
  eslint: {
    ignoreDuringBuilds: false, // Fix linting properly
  },
  images: {
    remotePatterns: [/* existing */],
    formats: ['image/avif', 'image/webp'], // Add modern formats
  },
  // Production optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Bundle analyzer for ongoing monitoring
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunks
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20
          },
          // Common chunks
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true
          },
          // Recharts separate chunk
          recharts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
            priority: 30
          },
          // Radix UI separate chunk
          radixui: {
            name: 'radixui',
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            priority: 30
          }
        }
      };
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

export default nextConfig;
```

**Expected Impact**:
- 15-20% bundle size reduction
- Better caching (vendor chunks)
- Improved tree-shaking

---

#### 2.3 Add Compression
**Effort**: Low | **Impact**: Medium

Install and configure compression:

```bash
npm install --save-dev @next/bundle-analyzer compression
```

For production deployment, enable gzip/brotli compression at server/CDN level.

**Expected Savings**: 60-70% reduction in transfer size
**Load Time Improvement**: ~1-2s on slower connections

---

#### 2.4 Implement Image Optimization
**Effort**: Low | **Impact**: Medium

Convert all static images to next/image:

```typescript
// Before
<img src="/logos/PEBL Logo-3.svg" alt="Logo" />

// After
import Image from 'next/image';
<Image
  src="/logos/PEBL Logo-3.svg"
  alt="Logo"
  width={200}
  height={50}
  priority // for above-fold images
/>
```

**Expected Impact**:
- Lazy loading for below-fold images
- Automatic format optimization (WebP/AVIF)
- Responsive images

---

### Priority 3: Medium Impact (Ongoing Improvements)

#### 3.1 Reduce Radix UI Bundle
**Effort**: Medium | **Impact**: Medium

Currently using 17+ separate Radix UI packages. Each adds ~10-20KB.

**Options**:
1. Replace rarely-used components with lighter alternatives
2. Create custom lightweight components for simple cases
3. Use `@radix-ui/react-primitives` where possible

**Expected Savings**: 50-100KB

---

#### 3.2 Implement Lazy Loading for Data Components
**Effort**: Medium | **Impact**: Medium

Components like DataTimeline, FileSelector, PinMarineDeviceData should be lazy-loaded:

```typescript
const DataTimeline = dynamic(
  () => import('@/components/pin-data/DataTimeline'),
  { loading: () => <div>Loading timeline...</div> }
);
```

**Expected Impact**: Faster initial page load, smoother UX

---

#### 3.3 Add Loading States and Suspense Boundaries
**Effort**: Medium | **Impact**: High (UX)

Implement React Suspense for better loading UX:

```typescript
<Suspense fallback={<PageSkeleton />}>
  <MapDrawingPage />
</Suspense>
```

**Expected Impact**:
- No actual speed improvement
- **Perceived performance**: Users see content faster
- Better UX during loading

---

#### 3.4 Optimize Data Fetching
**Effort**: High | **Impact**: High

Current issues:
- Multiple Supabase calls on page load
- No request batching
- No data caching strategy

**Solutions**:
1. Use React Query (already installed!) for caching
2. Batch Supabase requests where possible
3. Implement stale-while-revalidate strategy
4. Use Supabase realtime subscriptions efficiently

```typescript
// Example with React Query
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['projects', userId],
  queryFn: () => projectService.getProjects(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

**Expected Impact**:
- Reduced server load
- Faster subsequent navigations
- Better offline support

---

### Priority 4: Advanced Optimizations

#### 4.1 Implement Service Worker / PWA
**Effort**: High | **Impact**: High (Return visits)

```bash
npm install next-pwa
```

Benefits:
- Offline support
- Background sync
- Push notifications
- Cache API resources

**Expected Impact**:
- Near-instant load times for return visitors
- Offline functionality

---

#### 4.2 Server-Side Rendering Optimization
**Effort**: High | **Impact**: High

Current: Most pages use cookies (dynamic), preventing SSG.

**Solutions**:
1. Move auth checks to middleware
2. Use ISR (Incremental Static Regeneration) where possible
3. Implement edge rendering for global performance

**Expected Impact**:
- Faster TTFB (Time to First Byte)
- Better SEO
- Improved Core Web Vitals

---

#### 4.3 Database Query Optimization
**Effort**: High | **Impact**: High

Add indexes, optimize RLS policies, implement row-level caching.

**Expected Impact**:
- Faster data fetching
- Reduced backend load
- Better scalability

---

#### 4.4 Consider Alternative Chart Library
**Effort**: High | **Impact**: High

Migrate from Recharts to lighter alternative:

| Library | Size (gzipped) | Pros | Cons |
|---------|---------------|------|------|
| **Recharts** | ~200KB | Easy API, good docs | Heavy, slow |
| **Chart.js** | ~60KB | Fast, lightweight | Less React-friendly |
| **uPlot** | ~45KB | Extremely fast | Less features |
| **Visx** | ~100KB | Modular, powerful | Steeper learning curve |

**Recommendation**: **Chart.js** with react-chartjs-2 wrapper for best balance.

**Expected Savings**: 140KB
**Load Time Improvement**: ~300-500ms

---

## Estimated Impact Summary

### If ALL Priority 1 & 2 Recommendations Implemented:

#### Bundle Size Reduction
- Remove OpenLayers: **-600KB**
- Optimize Firebase: **-250KB**
- Lazy load Recharts: **-200KB** (from initial)
- Route code splitting: **-180KB** (from initial)
- Icon optimization: **-30KB**
- Production config: **-15% overall**

**Total Initial Bundle Reduction**: ~1.2MB → ~400-500KB

#### Load Time Improvements (Estimated on 4G connection)
- **Current**: ~2-3s (estimated production)
- **After Optimization**: ~0.8-1.2s
- **Improvement**: ~50-60% faster

#### Core Web Vitals (Estimated)
| Metric | Current | Optimized | Target |
|--------|---------|-----------|--------|
| **LCP** | ~3.5s | ~1.5s | < 2.5s ✅ |
| **FID** | ~150ms | ~80ms | < 100ms ✅ |
| **CLS** | ~0.1 | ~0.05 | < 0.1 ✅ |

---

## Implementation Roadmap

### Week 1: Critical Fixes
- [ ] Remove unused map library (OpenLayers or Leaflet)
- [ ] Optimize Firebase imports
- [ ] Update Next.js config with production optimizations

**Expected Impact**: 40% bundle reduction

### Week 2: Code Splitting
- [ ] Lazy load Recharts components
- [ ] Lazy load heavy route components
- [ ] Add loading skeletons

**Expected Impact**: 25% initial load improvement

### Week 3: Asset Optimization
- [ ] Implement image optimization
- [ ] Add compression
- [ ] Optimize icon imports

**Expected Impact**: 15% load time improvement

### Week 4: Advanced Optimizations
- [ ] Implement React Query caching
- [ ] Add Suspense boundaries
- [ ] Optimize data fetching patterns

**Expected Impact**: 30% perceived performance improvement

---

## Monitoring & Testing

### Tools to Install
```bash
npm install -D @next/bundle-analyzer lighthouse
```

### Performance Budget
Set performance budgets to prevent regression:

```json
{
  "budgets": [
    {
      "resourceSizes": [
        { "name": "initial-js", "budget": 500 },
        { "name": "total-js", "budget": 1000 },
        { "name": "image", "budget": 300 }
      ]
    }
  ]
}
```

### Continuous Monitoring
1. Run Lighthouse in CI/CD
2. Monitor bundle sizes on each PR
3. Set up Real User Monitoring (RUM)
4. Track Core Web Vitals

---

## Conclusion

The app has **significant optimization opportunities**. By implementing Priority 1 and 2 recommendations, you can achieve:

- **~1MB reduction** in initial bundle size
- **~50-60% faster** page load times
- **Better Core Web Vitals** scores
- **Improved user experience**

**Recommended Immediate Actions**:
1. Remove OpenLayers (if not used)
2. Optimize Firebase imports
3. Enable production Next.js config
4. Lazy load Recharts

**Estimated Total Effort**: 2-3 weeks for full implementation
**Estimated ROI**: High - significant improvements with reasonable effort

---

## Questions & Next Steps

Before implementing, please clarify:
1. Which map library do you prefer? (Leaflet vs OpenLayers)
2. Which chart features are essential? (Considering lighter alternatives)
3. What's the target load time? (Current goal: <2s on 4G)
4. Priority for mobile vs desktop optimization?

**Ready to proceed with implementation when you approve!**

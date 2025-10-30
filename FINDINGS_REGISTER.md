# Findings Register - Detailed Action Items
## PEBL DataApp Code Review

**Generated:** October 30, 2025
**Total Findings:** 33
**Critical:** 0 | **High:** 4 | **Medium:** 15 | **Low:** 14

---

## How to Use This Document

Each finding includes:
- **ID**: Unique identifier for tracking
- **Severity**: Critical/High/Medium/Low
- **Category**: Area of concern
- **Title**: Brief description
- **Location**: File/line reference
- **Risk**: Impact if not addressed
- **Effort**: Estimated time to fix
- **Owner**: Suggested assignee
- **Status**: Not Started/In Progress/Done

---

## CRITICAL FINDINGS (0)

None identified. The codebase has no critical security vulnerabilities or data loss risks.

---

## HIGH SEVERITY FINDINGS (4)

### FINDING #1: Build Configuration Warnings Suppressed
- **ID**: HIGH-001
- **Severity**: 🔴 High
- **Category**: Build & Deployment
- **Location**: `next.config.ts:157-158`
- **Risk**: Type errors and lint issues ship to production undetected
- **Effort**: 1 hour (fix) + ongoing (resolve all errors)
- **Priority**: Week 1, Day 1
- **Owner**: Lead Developer

**Current Code:**
```typescript
typescript: {
  ignoreBuildErrors: true, // TODO: Fix type errors and set to false
},
eslint: {
  ignoreDuringBuilds: true, // TODO: Fix linting errors and set to false
},
```

**Required Changes:**
```typescript
typescript: {
  ignoreBuildErrors: false, // ✅ Enable type checking
},
eslint: {
  ignoreDuringBuilds: false, // ✅ Enable lint checking
},
```

**Action Steps:**
1. Run `npm run typecheck` and document all errors
2. Create GitHub issues for each type error
3. Fix high-priority errors first (services, critical paths)
4. Set `ignoreBuildErrors: false`
5. Add to CI/CD pipeline: `npm run typecheck` must pass

**Acceptance Criteria:**
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Build succeeds with checks enabled
- [ ] CI/CD fails on type/lint errors

---

### FINDING #5: Date Parser Fragmentation (Technical Debt)
- **ID**: HIGH-002
- **Severity**: 🔴 High
- **Category**: Data Processing
- **Location**: Multiple files
  - `src/components/pin-data/csvParser.ts:64-762` (492 lines)
  - `src/lib/dateParser.ts` (122 lines)
  - `src/app/map-drawing/page.tsx` (ad-hoc parsing)
- **Risk**: Inconsistent date parsing behavior, bugs, difficult maintenance
- **Effort**: 16 hours (unification) + 8 hours (testing)
- **Priority**: Week 1-2
- **Owner**: Senior Developer
- **Referenced in**: CLAUDE.md Task 3

**Problem:**
Three separate date parsing implementations with different rules and edge case handling.

**Required Changes:**
Create `src/lib/unified-date-parser.ts` consolidating all date parsing logic.

**Implementation Plan:**

**Step 1: Create Unified Parser Interface (2 hours)**
```typescript
// src/lib/unified-date-parser.ts
export interface DateParseContext {
  fileType?: 'GP' | 'FPOD' | 'CROP' | 'CHEM' | 'WQ' | 'EDNA' | 'SUBCAM';
  fileName?: string;
  format?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'auto';
  allowInference?: boolean;
  validate?: boolean;
}

export interface DateParseResult {
  date: Date | null;
  confidence: 'high' | 'medium' | 'low';
  inferredFormat?: string;
  diagnostics: string[];
  warnings: string[];
}

export function parseUnifiedDate(
  dateString: string,
  context: DateParseContext = {}
): DateParseResult {
  // Unified implementation
}
```

**Step 2: Consolidate Logic (8 hours)**
- Merge format detection from csvParser.ts
- Add filename-based sanity checking from dateParser.ts
- Include 2-digit year handling
- Add extensive logging
- Handle all edge cases

**Step 3: Replace All Usage (4 hours)**
- Update csvParser.ts to use unified parser
- Update dateParser.ts to delegate to unified parser
- Update map-drawing/page.tsx to use unified parser
- Search for all date parsing code: `grep -r "new Date\|parse.*date" src/`

**Step 4: Comprehensive Testing (8 hours)**
```typescript
// tests/unified-date-parser.test.ts
describe('Unified Date Parser', () => {
  describe('Format Detection', () => {
    it('detects ISO 8601 format')
    it('detects DD/MM/YYYY vs MM/DD/YYYY')
    it('handles ambiguous dates (01/02/2024)')
    it('uses file type hint for disambiguation')
  });

  describe('2-Digit Year Handling', () => {
    it('converts 25 → 2025')
    it('handles century boundary (99 → 1999, 00 → 2000)')
  });

  describe('Edge Cases', () => {
    it('handles leap years')
    it('handles invalid dates (Feb 30)')
    it('handles timezone variations')
    it('handles Excel serial dates')
  });

  describe('Filename Sanity Checking', () => {
    it('validates parsed date against filename range')
    it('warns if date outside expected range')
  });
});
```

**Step 5: Documentation (2 hours)**
- Document all supported formats
- Document format detection rules
- Add examples for each use case
- Update CLAUDE.md to mark Task 3 complete

**Acceptance Criteria:**
- [ ] Single source of truth for date parsing
- [ ] All 3 old parsers replaced
- [ ] 80%+ test coverage
- [ ] Zero regressions in date parsing
- [ ] Comprehensive diagnostic logging

**Rollback Plan:**
- Keep old parsers commented out for 2 weeks
- A/B test with production data
- Monitor for parsing errors

---

### FINDING #21: Missing Security Headers
- **ID**: HIGH-003
- **Severity**: 🔴 High
- **Category**: Security
- **Location**: `next.config.ts` (not implemented)
- **Risk**: XSS attacks, clickjacking, MIME sniffing, information leakage
- **Effort**: 30 minutes
- **Priority**: Week 1, Day 1 (IMMEDIATE)
- **Owner**: Any Developer

**Current State:**
No security headers configured in Next.js.

**Required Implementation:**
```typescript
// next.config.ts - Add to nextConfig
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.basemaps.cartocdn.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-src 'none'",
          ].join('; ')
        }
      ]
    }
  ];
}
```

**Testing:**
```bash
# Test security headers are present
curl -I https://your-app.vercel.app | grep -i "x-frame-options"
curl -I https://your-app.vercel.app | grep -i "content-security-policy"

# Or use: https://securityheaders.com/
```

**CSP Tuning:**
After initial deployment, monitor console for CSP violations and adjust as needed.

**Acceptance Criteria:**
- [ ] All 7 security headers present
- [ ] SecurityHeaders.com score: A or A+
- [ ] No console CSP violations
- [ ] Application functions normally

---

### FINDING #29: Production Logging Blindness
- **ID**: HIGH-004
- **Severity**: 🔴 High
- **Category**: Observability
- **Location**: Entire codebase
  - 456 console.log statements in src/
  - Only 2 files use logger.ts
- **Risk**: Cannot debug production issues, silent failures
- **Effort**: 20-25 hours (estimated)
- **Priority**: Week 1-2
- **Owner**: Full Team (distributed work)

**Current State:**
```typescript
// Next.js removes console.log in production (next.config.ts:180-182)
compiler: {
  removeConsole: process.env.NODE_ENV === 'production' ? {
    exclude: ['error', 'warn'],
  } : false,
}
```

Result: **456 console.log statements disappear in production.**

**Migration Strategy:**

**Phase 1: Top 5 Files (Week 1, 8 hours)**
Priority files by log count:
1. `src/lib/supabase/file-storage-service.ts` (50+ logs)
2. `src/components/pin-data/PinChartDisplay.tsx` (46+ logs)
3. `src/lib/supabase/map-data-service.ts` (35+ logs)
4. `src/components/pin-data/csvParser.ts` (32+ logs)
5. `src/hooks/use-map-data.ts` (estimated 20+ logs)

**Phase 2: Services Layer (Week 2, 6 hours)**
All files in `src/lib/supabase/`:
- user-validation-service.ts
- plot-view-service.ts
- merged-files-service.ts
- project-service.ts
- sharing-service.ts

**Phase 3: Components (Week 3-4, 6 hours)**
High-usage components:
- DataTimeline.tsx
- FileActionsDialog.tsx
- MarinePlotsGrid.tsx

**Migration Pattern:**
```typescript
// BEFORE (lost in production)
console.log('🔐 Checking authentication for file upload...');
console.error('❌ File upload error:', uploadError);
console.log(`✅ Authenticated as user: ${user.id}`);

// AFTER (preserved in production)
import { logger } from '@/lib/logger';

logger.debug('Checking authentication for file upload', {
  context: 'file-storage-service',
});

logger.error('File upload error', uploadError, {
  context: 'file-storage-service',
  data: { fileName, pinId }
});

logger.info('User authenticated', {
  context: 'file-storage-service',
  data: { userId: user.id }
});
```

**Enhanced Logger (Sentry Integration):**
```typescript
// src/lib/logger.ts - Enhanced version
import * as Sentry from '@sentry/nextjs';

class Logger {
  error(message: string, error?: Error, options?: LogOptions): void {
    // Console output
    console.error(`[ERROR] ${message}`, error, options?.data);

    // Send to Sentry in production
    if (process.env.NODE_ENV === 'production' && error) {
      Sentry.captureException(error, {
        level: 'error',
        tags: { context: options?.context },
        extra: options?.data,
      });
    }
  }

  warn(message: string, options?: LogOptions): void {
    console.warn(`[WARN] ${message}`, options?.data);

    if (process.env.NODE_ENV === 'production') {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { context: options?.context },
        extra: options?.data,
      });
    }
  }
}
```

**Add ESLint Rule (prevent new console.logs):**
```json
// .eslintrc.json
{
  "rules": {
    "no-console": ["warn", {
      "allow": ["warn", "error"]
    }]
  }
}
```

**Progress Tracking:**
```bash
# Count remaining console.logs
grep -r "console\.log" src/ | wc -l

# Goal: 0 console.logs in src/ (except test files)
```

**Acceptance Criteria:**
- [ ] Zero console.log in src/ (excluding tests)
- [ ] All errors sent to Sentry
- [ ] ESLint rule prevents new console.logs
- [ ] Production logs searchable (Sentry + Axiom)

---

## MEDIUM SEVERITY FINDINGS (15)

### FINDING #2: No Automated Quality Gates
- **ID**: MED-001
- **Severity**: 🟡 Medium
- **Category**: CI/CD
- **Effort**: 4 hours
- **Priority**: Week 2

**Required:**
1. GitHub Actions workflow
2. Husky pre-commit hooks
3. lint-staged configuration

**Implementation:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm audit --audit-level=high
      - run: npm test
```

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Acceptance Criteria:**
- [ ] CI runs on every push
- [ ] Pre-commit hooks prevent bad commits
- [ ] PR requires passing CI

---

### FINDING #4: No PostGIS Extension
- **ID**: MED-002
- **Severity**: 🟡 Medium
- **Category**: Database/Geospatial
- **Effort**: 16 hours
- **Priority**: Month 1

**Implementation Plan:**

**Step 1: Enable PostGIS (1 hour)**
```sql
-- New migration: supabase/migrations/20251031_enable_postgis.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

**Step 2: Add Geometry Columns (2 hours)**
```sql
-- Add geometry columns (backward compatible)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);
ALTER TABLE lines ADD COLUMN IF NOT EXISTS geom GEOMETRY(LineString, 4326);
ALTER TABLE areas ADD COLUMN IF NOT EXISTS geom GEOMETRY(Polygon, 4326);

-- Populate from existing lat/lng
UPDATE pins SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE geom IS NULL;

UPDATE lines SET geom = ST_SetSRID(
  ST_MakeLine(
    ARRAY(
      SELECT ST_MakePoint((p->>'lng')::float, (p->>'lat')::float)
      FROM jsonb_array_elements(path) AS p
    )
  ),
  4326
) WHERE geom IS NULL;

UPDATE areas SET geom = ST_SetSRID(
  ST_MakePolygon(
    ST_MakeLine(
      ARRAY(
        SELECT ST_MakePoint((p->>'lng')::float, (p->>'lat')::float)
        FROM jsonb_array_elements(path || path->0) AS p
      )
    )
  ),
  4326
) WHERE geom IS NULL;
```

**Step 3: Add Spatial Indexes (1 hour)**
```sql
CREATE INDEX IF NOT EXISTS pins_geom_idx ON pins USING GIST (geom);
CREATE INDEX IF NOT EXISTS lines_geom_idx ON lines USING GIST (geom);
CREATE INDEX IF NOT EXISTS areas_geom_idx ON areas USING GIST (geom);
```

**Step 4: Create Helper Functions (3 hours)**
```sql
-- Find pins within radius (meters)
CREATE OR REPLACE FUNCTION find_pins_within_radius(
  center_lng FLOAT,
  center_lat FLOAT,
  radius_meters INT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_meters FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.label,
    p.lat,
    p.lng,
    ST_Distance(
      p.geom::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) AS distance_meters
  FROM pins p
  WHERE p.user_id = p_user_id
    AND ST_DWithin(
      p.geom::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Find pins within polygon
CREATE OR REPLACE FUNCTION find_pins_in_area(
  area_id_param UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  lat FLOAT,
  lng FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.label, p.lat, p.lng
  FROM pins p
  JOIN areas a ON a.id = area_id_param
  WHERE p.user_id = p_user_id
    AND ST_Within(p.geom, a.geom);
END;
$$ LANGUAGE plpgsql;
```

**Step 5: Update Services (6 hours)**
```typescript
// src/lib/supabase/spatial-query-service.ts (NEW FILE)
export class SpatialQueryService {
  async findPinsWithinRadius(
    centerLng: number,
    centerLat: number,
    radiusMeters: number
  ): Promise<Pin[]> {
    const { data, error } = await supabase
      .rpc('find_pins_within_radius', {
        center_lng: centerLng,
        center_lat: centerLat,
        radius_meters: radiusMeters,
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) throw error;
    return data;
  }

  async findPinsInArea(areaId: string): Promise<Pin[]> {
    const { data, error } = await supabase
      .rpc('find_pins_in_area', {
        area_id_param: areaId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) throw error;
    return data;
  }
}
```

**Step 6: Add UI Features (3 hours)**
- Radius search tool on map
- "Find nearby pins" button
- "Pins in this area" feature

**Acceptance Criteria:**
- [ ] PostGIS enabled
- [ ] Geometry columns populated
- [ ] Spatial indexes created
- [ ] Helper functions working
- [ ] UI implements radius search
- [ ] Performance: <100ms for 1000 pins

---

### FINDING #6: Outlier Detection Incomplete
- **ID**: MED-003
- **Severity**: 🟡 Medium
- **Category**: Data Quality
- **Effort**: 12 hours
- **Priority**: Month 1 (after user input)

**Status:** Backend complete, UI pending (CLAUDE.md Task 2)

**Required User Decisions:**
1. Detection method: IQR (recommended) vs StdDev vs Z-score
2. Handling: Remove vs Flag vs Replace
3. Scope: Width only vs Length+Width vs All numeric
4. Interface: Automatic vs Interactive vs Preview

**Once decided, implement:**
```typescript
// src/components/data-explorer/OutlierCleanupDialog.tsx (EXISTS but incomplete)
// Add:
- Method selection dropdown
- Column selection checkboxes
- Preview table showing outliers
- "Apply" and "Cancel" buttons
- Undo functionality
```

---

### FINDING #8: No Coordinate Transformation
- **ID**: MED-004
- **Severity**: 🟡 Medium
- **Category**: Geospatial
- **Effort**: 8 hours
- **Priority**: Month 2

**Add proj4js support:**
```bash
npm install proj4
npm install @types/proj4 --save-dev
```

```typescript
// src/lib/coordinate-transform.ts (NEW)
import proj4 from 'proj4';

// Define common projections
proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs'); // British National Grid

export function transformCoordinates(
  lng: number,
  lat: number,
  fromCRS: string = 'EPSG:4326',
  toCRS: string = 'EPSG:4326'
): [number, number] {
  return proj4(fromCRS, toCRS, [lng, lat]);
}
```

---

### FINDING #10: No Marker Clustering
- **ID**: MED-005
- **Severity**: 🟡 Medium
- **Category**: Performance
- **Effort**: 8 hours
- **Priority**: Month 1

**Implementation:**
```bash
npm install react-leaflet-cluster
```

```typescript
// src/components/map/LeafletMap.tsx
import MarkerClusterGroup from 'react-leaflet-cluster';

<MarkerClusterGroup
  chunkedLoading
  maxClusterRadius={50}
  spiderfyOnMaxZoom={true}
  showCoverageOnHover={false}
>
  {pins.map(pin => (
    <Marker key={pin.id} position={[pin.lat, pin.lng]}>
      {/* ... */}
    </Marker>
  ))}
</MarkerClusterGroup>
```

**Acceptance Criteria:**
- [ ] Smooth with 1000+ pins
- [ ] Clusters at low zoom
- [ ] Individual pins at high zoom

---

### FINDING #12: No Query Performance Monitoring
- **ID**: MED-006
- **Severity**: 🟡 Medium
- **Category**: Performance
- **Effort**: 4 hours
- **Priority**: Month 1

**Add query timing:**
```typescript
// src/lib/supabase/performance-monitor.ts (NEW)
export function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  return queryFn().then(result => {
    const duration = performance.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query: ${queryName}`, {
        context: 'performance-monitor',
        data: { duration, queryName }
      });
    }
    return result;
  });
}

// Usage:
const pins = await monitorQuery('getPins', () =>
  supabase.from('pins').select('*')
);
```

---

### FINDING #13: No Caching Layer
- **ID**: MED-007
- **Severity**: 🟡 Medium
- **Category**: Performance
- **Effort**: 12 hours
- **Priority**: Month 2

**Add Redis caching:**
```bash
npm install @upstash/redis
```

```typescript
// src/lib/cache.ts (NEW)
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return cached as T;

  const data = await fetcher();
  await redis.set(key, data, { ex: ttlSeconds });
  return data;
}

// Usage:
const projects = await cached(
  `projects:${userId}`,
  () => mapDataService.getProjects(),
  600 // 10 minutes
);
```

---

### FINDING #15: No Rate Limiting
- **ID**: MED-008
- **Severity**: 🟡 Medium
- **Category**: Security
- **Effort**: 6 hours
- **Priority**: Week 2

**Implementation shown in main review document.**

---

### FINDING #16: No Resilience Patterns
- **ID**: MED-009
- **Severity**: 🟡 Medium
- **Category**: Reliability
- **Effort**: 8 hours
- **Priority**: Month 1

**Add retry logic:**
```typescript
// src/lib/retry.ts (NEW)
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry exhausted');
}
```

---

### FINDING #18: Monolithic Components
- **ID**: MED-010
- **Severity**: 🟡 Medium
- **Category**: Code Quality
- **Effort**: 40 hours
- **Priority**: Month 2

**Refactor strategy:** See REFACTORING_PLAN.md (to be created)

---

### FINDING #20: Weak Password Policy
- **ID**: MED-011
- **Severity**: 🟡 Medium
- **Category**: Security
- **Effort**: 2 hours
- **Priority**: Week 1

**Update password requirements:**
```typescript
// src/components/auth/UserMenu.tsx
const handlePasswordChange = async () => {
  // Validation
  if (newPassword.length < 12) {
    setPasswordError('Password must be at least 12 characters');
    return;
  }

  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*]/.test(newPassword);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    setPasswordError('Password must include uppercase, lowercase, number, and special character');
    return;
  }

  // ... rest of change logic
};
```

---

### FINDING #22: Limited Input Sanitization
- **ID**: MED-012
- **Severity**: 🟡 Medium
- **Category**: Security
- **Effort**: 6 hours
- **Priority**: Week 3

**Add DOMPurify:**
```bash
npm install isomorphic-dompurify
```

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Before saving user-provided content
const sanitizedName = DOMPurify.sanitize(userName);
const sanitizedNotes = DOMPurify.sanitize(notes);
```

---

### FINDING #23: Insufficient File Upload Validation
- **ID**: MED-013
- **Severity**: 🟡 Medium
- **Category**: Security
- **Effort**: 2 hours
- **Priority**: Week 2

**Implementation shown in main review.**

---

### FINDING #25: No GDPR Compliance Tools
- **ID**: MED-014
- **Severity**: 🟡 Medium
- **Category**: Compliance
- **Effort**: 16 hours
- **Priority**: Month 2

**Required:**
1. Data export API
2. Right to erasure (with cascades)
3. Privacy policy page
4. Consent management

---

### FINDING #26: No Audit Logging
- **ID**: MED-015
- **Severity**: 🟡 Medium
- **Category**: Governance
- **Effort**: 12 hours
- **Priority**: Month 2

**Schema shown in main review.**

---

## LOW SEVERITY FINDINGS (14)

*(Condensed - Full details available on request)*

### FINDING #3: No Error Recovery Strategy
- **ID**: LOW-001
- **Effort**: 8 hours
- **Priority**: Month 3

### FINDING #7: No Merge Preview UI
- **ID**: LOW-002
- **Effort**: 4 hours
- **Priority**: Month 3

### FINDING #11: Single Basemap Option
- **ID**: LOW-003
- **Effort**: 4 hours
- **Priority**: Month 3

### FINDING #14: No Connection Error Handling
- **ID**: LOW-004
- **Effort**: 4 hours
- **Priority**: Month 2

### FINDING #17: No Bundle Size Monitoring
- **ID**: LOW-005
- **Effort**: 2 hours
- **Priority**: Month 2

### FINDING #19: Short Image Cache TTL
- **ID**: LOW-006
- **Effort**: 15 minutes
- **Priority**: Week 2

### FINDING #24: No Secrets Rotation
- **ID**: LOW-007
- **Effort**: Documentation only
- **Priority**: Month 2

### FINDING #27: Undefined Data Retention
- **ID**: LOW-008
- **Effort**: Documentation only
- **Priority**: Month 2

### FINDING #31: No Performance Monitoring
- **ID**: LOW-009
- **Effort**: 4 hours
- **Priority**: Week 2

### FINDING #32: Poor Onboarding Experience
- **ID**: LOW-010
- **Effort**: 2 hours
- **Priority**: Week 1

### FINDING #33: Inconsistent Inline Documentation
- **ID**: LOW-011
- **Effort**: 40 hours (ongoing)
- **Priority**: Ongoing

---

## TRACKING SPREADSHEET FORMAT

For project management tools (Jira, Linear, etc.):

```csv
ID,Severity,Category,Title,Location,Risk,Effort,Priority,Status,Owner
HIGH-001,High,Build,Build warnings suppressed,next.config.ts:157,Type errors in prod,1h,Week 1,Not Started,Lead Dev
HIGH-002,High,Data,Date parser fragmentation,Multiple files,Inconsistent parsing,24h,Week 1-2,Not Started,Senior Dev
HIGH-003,High,Security,Missing security headers,next.config.ts,XSS/Clickjacking,30m,Day 1,Not Started,Any Dev
HIGH-004,High,Observability,Production logging blindness,Entire codebase,Cannot debug,20h,Week 1-2,Not Started,Team
...
```

---

## NEXT ACTIONS

1. **Import to Project Management:** Create issues/tickets for each finding
2. **Assign Owners:** Distribute work across team
3. **Set Sprint Goals:** Focus on High severity first
4. **Track Progress:** Update status column weekly
5. **Review & Adjust:** Reassess priorities as work progresses

**Target:** All High findings resolved in 2 weeks
**Goal:** Production deployment in 3 months

---

**Document Status:** Complete and actionable
**Next Update:** After Week 1 sprint completion

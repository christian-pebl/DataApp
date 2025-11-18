# Admin Dashboard Skill

**Trigger:** "admin dashboard" or "call admin dashboard" or "show admin dashboard"

**Purpose:** Opens the performance tracking dashboard for monitoring test results, performance metrics, and optimization opportunities.

---

## What This Skill Does

When invoked, this skill:
1. Opens the admin dashboard at `http://localhost:9002/admin-dashboard`
2. Uses Playwright MCP to navigate to the dashboard
3. Takes a screenshot to confirm the dashboard loaded
4. Shows all completed tests and their performance metrics

---

## Dashboard Contents

The admin dashboard displays:

### 1. **Test Results Overview**
- All completed E2E tests
- Pass/fail status
- Execution time
- Last run timestamp

### 2. **Performance Metrics**
- Current performance measurements
- Target performance goals
- Delta (how far from target)
- Status indicators (✅ passing, ⚠️ warning, ❌ failing)

### 3. **Optimization Opportunities**
- List of all identified performance bottlenecks
- Estimated improvement gain (% or ms)
- Implementation effort (hours)
- ROI calculation (gain/effort ratio)
- Priority tier (Tier 1, 2, 3)

### 4. **Visual Performance Tracking**
- Timeline chart showing performance trends
- Before/after comparison charts
- Optimization impact visualization
- Progress toward performance targets

### 5. **Implementation Status**
- Which optimizations have been implemented
- Which are in progress
- Which are planned
- Actual vs expected improvements

---

## Usage

```
User: admin dashboard
Claude: [Opens dashboard at localhost:9002/admin-dashboard]
Claude: [Takes screenshot and shows metrics summary]
```

---

## Data Sources

The dashboard reads from:
- `test-reports/EDNA-VISUALIZATION-PERFORMANCE.md`
- `test-reports/COMPREHENSIVE-OPTIMIZATION-PLAN.md`
- `test-reports/HOLISTIC-ANALYSIS-SUMMARY.md`
- `test-reports/TEST-AUTOMATION-PROGRESS.md`
- Future: JSON metrics files in `test-reports/metrics/`

---

## Implementation Files

- **Dashboard Page:** `src/app/admin-dashboard/page.tsx`
- **Metrics Parser:** `src/lib/performance-metrics-parser.ts`
- **Data Schema:** `test-reports/metrics/schema.json`
- **Historical Data:** `test-reports/metrics/history/`

---

## When to Use This Skill

Use this skill to:
- Check current application performance status
- Review completed test results
- Identify optimization priorities
- Track performance improvements over time
- Generate performance reports for stakeholders
- Monitor regression (performance getting worse)

---

## Efficient Usage Pattern

```typescript
// Step 1: Navigate to dashboard
await mcp__playwright__browser_navigate({ url: 'http://localhost:9002/admin-dashboard' });

// Step 2: Wait for metrics to load
await mcp__playwright__browser_wait_for({ text: 'Performance Metrics', time: 5 });

// Step 3: Take screenshot (only if needed for user)
await mcp__playwright__browser_take_screenshot({ filename: 'admin-dashboard.png' });

// Step 4: Extract metrics using evaluate (efficient, no snapshot)
const metrics = await mcp__playwright__browser_evaluate({
  function: `() => ({
    totalTests: document.querySelectorAll('[data-test-result]').length,
    failingTests: document.querySelectorAll('[data-test-status="fail"]').length,
    criticalBottlenecks: document.querySelectorAll('[data-priority="critical"]').length
  })`
});
```

---

## Performance Metrics Schema

All test results should follow this structure:

```typescript
interface PerformanceMetric {
  // Identification
  testName: string;
  category: 'rendering' | 'parsing' | 'network' | 'interaction';
  component: string;

  // Timing
  timestamp: string;  // ISO 8601
  currentValue: number;  // milliseconds
  targetValue: number;  // milliseconds

  // Analysis
  status: 'passing' | 'warning' | 'failing';
  deltaFromTarget: number;  // positive = over target
  deltaPercentage: number;  // 87 means 87% over target

  // Optimization
  hasOptimization: boolean;
  estimatedImprovement: number;  // milliseconds
  improvementPercentage: number;  // 60 means 60% faster
  implementationEffort: number;  // hours
  roi: number;  // improvement% / effort hours
  priority: 'critical' | 'high' | 'medium' | 'low';
  tier: 1 | 2 | 3;

  // Implementation
  implemented: boolean;
  implementedDate?: string;
  actualImprovement?: number;  // measured after implementation
}
```

---

## Future Enhancements

- Real-time performance monitoring during development
- Automated regression detection
- Performance budget enforcement
- CI/CD integration for performance gates
- Historical trend analysis
- Comparison with industry benchmarks

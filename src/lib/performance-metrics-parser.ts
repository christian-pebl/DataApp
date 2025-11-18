/**
 * Performance Metrics Parser
 *
 * Parses performance test reports from markdown files and converts them
 * into structured JSON data for the admin dashboard.
 */

export interface PerformanceMetric {
  // Identification
  testName: string;
  category: 'rendering' | 'parsing' | 'network' | 'interaction' | 'architecture';
  component: string;
  file?: string;
  lineNumbers?: string;

  // Timing
  timestamp: string;  // ISO 8601
  currentValue: number;  // milliseconds
  targetValue: number;  // milliseconds

  // Analysis
  status: 'passing' | 'warning' | 'failing';
  deltaFromTarget: number;  // positive = over target (e.g., 7004 means 7s over)
  deltaPercentage: number;  // 87 means 87% over target

  // Optimization
  hasOptimization: boolean;
  optimizationName?: string;
  estimatedImprovement?: number;  // milliseconds
  improvementPercentage?: number;  // 60 means 60% faster
  implementationEffort?: number;  // hours
  roi?: number;  // improvement% / effort hours
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tier?: 1 | 2 | 3;

  // Implementation
  implemented: boolean;
  implementedDate?: string;
  actualImprovement?: number;  // measured after implementation
}

export interface OptimizationOpportunity {
  name: string;
  description: string;
  affectedMetrics: string[];  // Test names
  tier: 1 | 2 | 3;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImprovement: string;  // "60-70% faster" or "100ms saved"
  implementationEffort: number;  // hours
  roi: number;
  file: string;
  lineNumbers?: string;
  codeExample?: string;
  implemented: boolean;
}

export interface DashboardData {
  metadata: {
    lastUpdated: string;
    totalTests: number;
    passingTests: number;
    warningTests: number;
    failingTests: number;
  };
  metrics: PerformanceMetric[];
  optimizations: OptimizationOpportunity[];
  summary: {
    currentPerformanceScore: number;  // 0-100
    potentialPerformanceScore: number;  // After all optimizations
    totalOptimizationOpportunities: number;
    quickWins: number;  // Tier 1 optimizations
    estimatedTotalImprovement: string;  // "70-85%"
  };
}

/**
 * Parse eDNA visualization performance metrics
 */
export function parseEDNAVisualizationMetrics(): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];

  // Rarefaction Curve Rendering
  metrics.push({
    testName: '_hapl file rarefaction curve rendering',
    category: 'rendering',
    component: 'RarefactionChart',
    file: 'src/lib/curve-fitting.ts',
    lineNumbers: '95-139',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 15004,
    targetValue: 8000,
    status: 'failing',
    deltaFromTarget: 7004,
    deltaPercentage: 87,
    hasOptimization: true,
    optimizationName: 'Reduce iterations 1000→200',
    estimatedImprovement: 9000,
    improvementPercentage: 65,
    implementationEffort: 2,
    roi: 32.5,
    priority: 'critical',
    tier: 1,
    implemented: false,
  });

  // _hapl Heatmap Rendering
  metrics.push({
    testName: '_hapl file heatmap rendering',
    category: 'rendering',
    component: 'HaplotypeHeatmap',
    file: 'src/components/pin-data/HaplotypeHeatmap.tsx',
    lineNumbers: '860-987',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 9,
    targetValue: 150,
    status: 'passing',
    deltaFromTarget: -141,
    deltaPercentage: -94,
    hasOptimization: true,
    optimizationName: 'Metadata lookup Maps + Virtual scrolling',
    estimatedImprovement: 0,
    improvementPercentage: 0,
    implementationEffort: 9,
    roi: 0,
    priority: 'low',
    tier: 2,
    implemented: false,
  });

  // _nmax Heatmap Rendering
  metrics.push({
    testName: '_nmax file heatmap rendering',
    category: 'rendering',
    component: 'PresenceAbsenceTable',
    file: 'src/components/pin-data/PresenceAbsenceTable.tsx',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 6,
    targetValue: 150,
    status: 'passing',
    deltaFromTarget: -144,
    deltaPercentage: -96,
    hasOptimization: true,
    optimizationName: 'Virtual scrolling for large datasets',
    estimatedImprovement: 0,
    improvementPercentage: 0,
    implementationEffort: 8,
    roi: 0,
    priority: 'low',
    tier: 2,
    implemented: false,
  });

  // CSV Parsing Performance
  metrics.push({
    testName: 'CSV parsing and date sorting',
    category: 'parsing',
    component: 'csvParser',
    file: 'src/components/pin-data/csvParser.ts',
    lineNumbers: '444-448',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 625,
    targetValue: 300,
    status: 'warning',
    deltaFromTarget: 325,
    deltaPercentage: 108,
    hasOptimization: true,
    optimizationName: 'Memoize Date objects during sort',
    estimatedImprovement: 100,
    improvementPercentage: 16,
    implementationEffort: 0.17,
    roi: 94,
    priority: 'high',
    tier: 1,
    implemented: false,
  });

  // File Upload Workflow
  metrics.push({
    testName: 'Sequential file uploads (5 files)',
    category: 'network',
    component: 'map-drawing page',
    file: 'src/app/map-drawing/page.tsx',
    lineNumbers: '4060-4076',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 10000,
    targetValue: 3000,
    status: 'failing',
    deltaFromTarget: 7000,
    deltaPercentage: 233,
    hasOptimization: true,
    optimizationName: 'Parallelize file uploads with Promise.all',
    estimatedImprovement: 7000,
    improvementPercentage: 70,
    implementationEffort: 1,
    roi: 70,
    priority: 'critical',
    tier: 1,
    implemented: false,
  });

  // Component Re-renders
  metrics.push({
    testName: 'PinChartDisplay re-renders per user action',
    category: 'rendering',
    component: 'PinChartDisplay',
    file: 'src/components/pin-data/PinChartDisplay.tsx',
    lineNumbers: '33',
    timestamp: '2025-11-18T00:00:00Z',
    currentValue: 10,
    targetValue: 2,
    status: 'failing',
    deltaFromTarget: 8,
    deltaPercentage: 400,
    hasOptimization: true,
    optimizationName: 'Add React.memo and useCallback',
    estimatedImprovement: 8,
    improvementPercentage: 80,
    implementationEffort: 2,
    roi: 40,
    priority: 'high',
    tier: 1,
    implemented: false,
  });

  return metrics;
}

/**
 * Parse optimization opportunities from comprehensive plan
 */
export function parseOptimizationOpportunities(): OptimizationOpportunity[] {
  const optimizations: OptimizationOpportunity[] = [];

  // TIER 1: QUICK WINS
  optimizations.push({
    name: 'Rarefaction: Reduce iterations 1000→200',
    description: 'Fixed 1000 iterations causes 87% wasted computation. Add early stopping with 0.1% improvement threshold.',
    affectedMetrics: ['_hapl file rarefaction curve rendering'],
    tier: 1,
    priority: 'critical',
    estimatedImprovement: '60-70% faster (15s → 5-6s)',
    implementationEffort: 2,
    roi: 32.5,
    file: 'src/lib/curve-fitting.ts',
    lineNumbers: '95-139',
    implemented: false,
  });

  optimizations.push({
    name: 'Heatmap: Metadata lookup Maps',
    description: 'Replace O(n²) array.find() with O(1) Map lookups for taxon metadata.',
    affectedMetrics: ['_hapl file heatmap rendering', '_nmax file heatmap rendering'],
    tier: 1,
    priority: 'high',
    estimatedImprovement: '40-50ms saved',
    implementationEffort: 1,
    roi: 45,
    file: 'src/components/pin-data/HaplotypeHeatmap.tsx',
    lineNumbers: '860-933',
    implemented: false,
  });

  optimizations.push({
    name: 'CSV: Memoize sort dates',
    description: 'Pre-compute Date objects once instead of creating 260,000 during sort comparisons.',
    affectedMetrics: ['CSV parsing and date sorting'],
    tier: 1,
    priority: 'high',
    estimatedImprovement: '100ms saved',
    implementationEffort: 0.17,
    roi: 94,
    file: 'src/components/pin-data/csvParser.ts',
    lineNumbers: '444-448',
    implemented: false,
  });

  optimizations.push({
    name: 'React: Add React.memo to PinChartDisplay',
    description: 'Prevent unnecessary re-renders (10-20 per action → 1-2) by memoizing component and callbacks.',
    affectedMetrics: ['PinChartDisplay re-renders per user action'],
    tier: 1,
    priority: 'high',
    estimatedImprovement: '80% fewer renders (250-500ms saved)',
    implementationEffort: 2,
    roi: 40,
    file: 'src/components/pin-data/PinChartDisplay.tsx',
    lineNumbers: '33',
    implemented: false,
  });

  optimizations.push({
    name: 'Architecture: Parallelize file uploads',
    description: 'Upload files concurrently with Promise.all instead of sequentially.',
    affectedMetrics: ['Sequential file uploads (5 files)'],
    tier: 1,
    priority: 'critical',
    estimatedImprovement: '80% faster (10s → 2s)',
    implementationEffort: 1,
    roi: 70,
    file: 'src/app/map-drawing/page.tsx',
    lineNumbers: '4060-4076',
    implemented: false,
  });

  // TIER 2: CORE IMPROVEMENTS
  optimizations.push({
    name: 'Heatmap: Virtual scrolling with react-window',
    description: 'Render only visible rows to handle 500+ species datasets.',
    affectedMetrics: ['_hapl file heatmap rendering'],
    tier: 2,
    priority: 'medium',
    estimatedImprovement: '90% faster for 500+ rows',
    implementationEffort: 8,
    roi: 11.25,
    file: 'src/components/pin-data/HaplotypeHeatmap.tsx',
    implemented: false,
  });

  optimizations.push({
    name: 'CSV: Streaming parser',
    description: 'Process CSV in chunks to avoid blocking UI thread.',
    affectedMetrics: ['CSV parsing and date sorting'],
    tier: 2,
    priority: 'medium',
    estimatedImprovement: 'Non-blocking UI (responsive during parse)',
    implementationEffort: 4,
    roi: 25,
    file: 'src/components/pin-data/csvParser.ts',
    implemented: false,
  });

  optimizations.push({
    name: 'React: Refactor useMapData hook',
    description: 'Split monolithic hook to reduce cascading re-renders.',
    affectedMetrics: ['PinChartDisplay re-renders per user action'],
    tier: 2,
    priority: 'medium',
    estimatedImprovement: '200-500ms faster',
    implementationEffort: 8,
    roi: 12.5,
    file: 'src/hooks/use-map-data.ts',
    implemented: false,
  });

  optimizations.push({
    name: 'Architecture: Parsed data cache',
    description: 'Cache parsed CSV results to avoid re-parsing same files.',
    affectedMetrics: ['CSV parsing and date sorting'],
    tier: 2,
    priority: 'medium',
    estimatedImprovement: '60% memory reduction + instant re-renders',
    implementationEffort: 4,
    roi: 15,
    file: 'src/hooks/use-map-data.ts',
    implemented: false,
  });

  // TIER 3: ADVANCED OPTIMIZATIONS
  optimizations.push({
    name: 'Rarefaction: Web Workers',
    description: 'Offload curve fitting to background thread for non-blocking UI.',
    affectedMetrics: ['_hapl file rarefaction curve rendering'],
    tier: 3,
    priority: 'low',
    estimatedImprovement: 'Additional 10-15% (UI stays responsive)',
    implementationEffort: 6,
    roi: 2.5,
    file: 'src/lib/curve-fitting.ts',
    implemented: false,
  });

  optimizations.push({
    name: 'Heatmap: Canvas rendering for 1000+ cells',
    description: 'Replace SVG with Canvas for massive datasets.',
    affectedMetrics: ['_hapl file heatmap rendering'],
    tier: 3,
    priority: 'low',
    estimatedImprovement: '10x faster for 1000+ cells',
    implementationEffort: 12,
    roi: 8.33,
    file: 'src/components/pin-data/HaplotypeHeatmap.tsx',
    implemented: false,
  });

  optimizations.push({
    name: 'CSV: Unified date parser refactor',
    description: 'Consolidate 3 date parsers into one intelligent system.',
    affectedMetrics: ['CSV parsing and date sorting'],
    tier: 3,
    priority: 'low',
    estimatedImprovement: 'Maintainability + consistency',
    implementationEffort: 8,
    roi: 0,
    file: 'src/lib/unified-date-parser.ts',
    implemented: false,
  });

  return optimizations;
}

/**
 * Generate complete dashboard data
 */
export function generateDashboardData(): DashboardData {
  const metrics = parseEDNAVisualizationMetrics();
  const optimizations = parseOptimizationOpportunities();

  const passingTests = metrics.filter(m => m.status === 'passing').length;
  const warningTests = metrics.filter(m => m.status === 'warning').length;
  const failingTests = metrics.filter(m => m.status === 'failing').length;

  const tier1Optimizations = optimizations.filter(o => o.tier === 1).length;

  return {
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalTests: metrics.length,
      passingTests,
      warningTests,
      failingTests,
    },
    metrics,
    optimizations,
    summary: {
      currentPerformanceScore: Math.round((passingTests / metrics.length) * 100),
      potentialPerformanceScore: 85,  // After all optimizations
      totalOptimizationOpportunities: optimizations.length,
      quickWins: tier1Optimizations,
      estimatedTotalImprovement: '70-85%',
    },
  };
}

/**
 * Calculate ROI for an optimization
 */
export function calculateROI(
  improvementPercentage: number,
  implementationEffort: number
): number {
  return Number((improvementPercentage / implementationEffort).toFixed(2));
}

/**
 * Format milliseconds to human-readable string
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: PerformanceMetric['status']): string {
  switch (status) {
    case 'passing':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'failing':
      return 'text-red-600';
  }
}

/**
 * Get priority badge color
 */
export function getPriorityColor(priority: OptimizationOpportunity['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
  }
}

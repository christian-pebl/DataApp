'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load ChartDisplay to reduce initial bundle
const ChartDisplay = dynamic(
  () => import('@/components/dataflow/ChartDisplay').then(mod => ({ default: mod.ChartDisplay })),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default ChartDisplay;

// Re-export the YAxisConfig type for convenience
export type { YAxisConfig } from '@/components/dataflow/ChartDisplay';

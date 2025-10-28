'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load HeatmapDisplay to reduce initial bundle
const HeatmapDisplay = dynamic(
  () => import('@/components/dataflow/HeatmapDisplay').then(mod => ({ default: mod.HeatmapDisplay })),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading heatmap...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default HeatmapDisplay;

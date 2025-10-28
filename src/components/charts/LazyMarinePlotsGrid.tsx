'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load MarinePlotsGrid to reduce initial bundle
const MarinePlotsGrid = dynamic(
  () => import('@/components/marine/MarinePlotsGrid').then(mod => ({ default: mod.MarinePlotsGrid })),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading charts...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default MarinePlotsGrid;

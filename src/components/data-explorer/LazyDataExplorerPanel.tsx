'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton for DataExplorerPanel
const DataExplorerSkeleton = () => (
  <div className="h-full flex flex-col p-4 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <Skeleton className="h-10 w-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  </div>
);

// Lazy load DataExplorerPanel (heavy component with file operations)
const LazyDataExplorerPanel = dynamic(
  () => import('./DataExplorerPanel').then(mod => ({ default: mod.DataExplorerPanel })),
  {
    loading: () => <DataExplorerSkeleton />,
    ssr: false
  }
);

export default LazyDataExplorerPanel;

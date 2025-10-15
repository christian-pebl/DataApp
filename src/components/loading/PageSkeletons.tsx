'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MapIcon, Database, BarChart3 } from 'lucide-react';

// Map loading skeleton
export function MapSkeleton() {
  return (
    <div className="relative w-full h-full bg-muted/10 rounded-lg overflow-hidden">
      <div className="absolute inset-0 skeleton" />
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center space-y-3 fade-in">
          <MapIcon className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/50">Loading map...</p>
        </div>
      </div>
    </div>
  );
}

// Pin list sidebar skeleton
export function PinListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

// Data panel skeleton
export function DataPanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

// Chart/plot skeleton
export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height }}>
      <div className="absolute inset-0 skeleton" />
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center space-y-2 fade-in">
          <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50">Loading visualization...</p>
        </div>
      </div>
    </div>
  );
}

// Project selector skeleton
export function ProjectSelectorSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-9" />
    </div>
  );
}

// Marine plots skeleton
export function MarinePlotsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// File list skeleton
export function FileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 fade-in" style={{ animationDelay: `${i * 75}ms` }}>
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Data timeline skeleton
export function DataTimelineSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-2">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 fade-in" style={{ animationDelay: `${i * 30}ms` }}>
            <Skeleton className="h-16 w-16 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

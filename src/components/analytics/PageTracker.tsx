/**
 * PageTracker Component
 *
 * Client-side component that automatically tracks page views using the analytics service
 * This should be included in the root layout to track all page navigation
 */

'use client';

import { usePageTracking } from '@/hooks/use-analytics';

export function PageTracker() {
  // This hook automatically tracks page views whenever the route changes
  usePageTracking();

  // This component renders nothing - it just runs the tracking logic
  return null;
}

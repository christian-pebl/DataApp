/**
 * Analytics Hooks
 *
 * React hooks for tracking user behavior and feature usage
 */

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  analyticsService,
  EventType,
  EventCategory,
} from '@/lib/analytics/analytics-service';

/**
 * Hook to automatically track page views
 * Add this to your root layout or app component
 */
export function usePageTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      analyticsService.trackPageView(pathname);
    }
  }, [pathname]);
}

/**
 * Hook to track events from components
 *
 * @example
 * const { track, trackError } = useAnalytics();
 *
 * const handleClick = () => {
 *   track('pin_created', 'data_object', { label: 'My Pin' });
 * };
 */
export function useAnalytics() {
  const track = useCallback(
    (
      eventType: EventType,
      category: EventCategory,
      data?: Record<string, any>
    ) => {
      analyticsService.trackAction(eventType, category, data);
    },
    []
  );

  const trackError = useCallback(
    (context: string, error: Error | string, data?: Record<string, any>) => {
      analyticsService.trackError(context, error, data);
    },
    []
  );

  const trackFeature = useCallback(
    (featureName: string, action: string, data?: Record<string, any>) => {
      analyticsService.trackFeature(featureName, action, data);
    },
    []
  );

  const trackDialogOpen = useCallback(
    (dialogName: string, data?: Record<string, any>) => {
      analyticsService.trackDialogOpen(dialogName, data);
    },
    []
  );

  const startTiming = useCallback(() => {
    return analyticsService.startTiming();
  }, []);

  const trackWithTiming = useCallback(
    (
      eventType: EventType,
      category: EventCategory,
      startTime: number,
      data?: Record<string, any>
    ) => {
      analyticsService.trackAction(eventType, category, data, startTime);
    },
    []
  );

  return {
    track,
    trackError,
    trackFeature,
    trackDialogOpen,
    startTiming,
    trackWithTiming,
  };
}

/**
 * Hook to track component mount/unmount timing
 *
 * @example
 * useComponentTracking('PinChartDisplay', { pinId: '123' });
 */
export function useComponentTracking(
  componentName: string,
  data?: Record<string, any>
) {
  useEffect(() => {
    const startTime = Date.now();

    analyticsService.trackFeature(componentName, 'mounted', data);

    return () => {
      const duration = Date.now() - startTime;
      analyticsService.trackFeature(componentName, 'unmounted', {
        ...data,
        time_on_component_ms: duration,
      });
    };
  }, [componentName, data]);
}

/**
 * Hook to track dialog/modal visibility
 *
 * @example
 * useDialogTracking('ShareDialog', isOpen, { pinId });
 */
export function useDialogTracking(
  dialogName: string,
  isOpen: boolean,
  data?: Record<string, any>
) {
  useEffect(() => {
    if (isOpen) {
      analyticsService.trackDialogOpen(dialogName, data);
    }
  }, [dialogName, isOpen, data]);
}

/**
 * Hook to track feature usage on mount
 *
 * @example
 * useFeatureTracking('rarefaction-curve', { fileType: 'hapl' });
 */
export function useFeatureTracking(
  featureName: string,
  data?: Record<string, any>
) {
  useEffect(() => {
    analyticsService.trackFeature(featureName, 'accessed', data);
  }, [featureName, data]);
}

/**
 * Hook to track file viewing with time tracking
 *
 * @example
 * useFileViewTracking(fileName, fileType, { pinId, projectId });
 */
export function useFileViewTracking(
  fileName?: string,
  fileType?: string,
  metadata?: Record<string, any>
) {
  useEffect(() => {
    if (!fileName) return;

    const startTime = Date.now();

    // Track file view
    analyticsService.trackAction('file_viewed', 'file', {
      file_name: fileName,
      file_type: fileType,
      ...metadata,
    }).catch(err => console.error('Analytics tracking error:', err));

    return () => {
      // Track view duration when component unmounts
      const duration = Date.now() - startTime;
      analyticsService.trackAction('file_view_ended', 'file', {
        file_name: fileName,
        file_type: fileType,
        view_duration_ms: duration,
        ...metadata,
      }).catch(err => console.error('Analytics tracking error:', err));
    };
  }, [fileName, fileType, metadata]);
}

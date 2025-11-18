/**
 * Analytics Service
 *
 * Tracks user behavior, feature usage, and engagement metrics throughout the application.
 * All tracking is done asynchronously and never blocks the main application flow.
 */

import { createClient } from '@/lib/supabase/client';

// Event categories define broad groupings of actions
export type EventCategory =
  | 'authentication'
  | 'project'
  | 'data_object'  // pins, lines, areas
  | 'file'
  | 'visualization'
  | 'sharing'
  | 'navigation'
  | 'error';

// Event types define specific actions within categories
export type EventType =
  // Authentication
  | 'login'
  | 'logout'
  | 'signup'
  | 'signup_attempt'
  | 'session_end'
  // Projects
  | 'project_created'
  | 'project_renamed'
  | 'project_deleted'
  | 'project_switched'
  | 'project_opened'
  // Data objects
  | 'pin_created'
  | 'pin_updated'
  | 'pin_deleted'
  | 'pin_viewed'
  | 'line_created'
  | 'line_updated'
  | 'line_deleted'
  | 'area_created'
  | 'area_updated'
  | 'area_deleted'
  | 'tag_created'
  | 'tag_applied'
  | 'tag_deleted'
  // Files
  | 'file_uploaded'
  | 'file_download_started'
  | 'file_downloaded'
  | 'file_deleted'
  | 'file_opened'
  | 'file_preview'
  | 'files_merged'
  // Visualization
  | 'chart_viewed'
  | 'chart_type_changed'
  | 'date_range_changed'
  | 'rarefaction_viewed'
  | 'heatmap_viewed'
  | 'plot_view_saved'
  | 'plot_view_loaded'
  // Sharing
  | 'share_created'
  | 'share_accepted'
  | 'share_revoked'
  | 'share_link_generated'
  // Navigation
  | 'page_viewed'
  | 'feature_accessed'
  | 'dialog_opened'
  | 'tab_switched'
  // Errors
  | 'error_occurred'
  | 'network_error'
  | 'validation_error';

interface AnalyticsEvent {
  eventType: EventType;
  eventCategory: EventCategory;
  eventData?: Record<string, any>;
  durationMs?: number;
  errorMessage?: string;
  success?: boolean;
}

interface TrackingContext {
  sessionId: string;
  pagePath: string;
  referrer: string;
  userAgent: string;
}

class AnalyticsService {
  private supabase = createClient();
  private sessionId: string;
  private pageLoadTime: number;
  private isEnabled = true;
  private isInitialized = false;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Generate unique session ID
    this.sessionId = this.getOrCreateSessionId();
    this.pageLoadTime = Date.now();

    // Initialize tracking
    if (typeof window !== 'undefined') {
      this.initializeTracking();
    }
  }

  /**
   * Initialize browser-side tracking
   */
  private initializeTracking(): void {
    if (this.isInitialized) return;

    // Track page unload for session duration
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
      this.flush(); // Flush any pending events
    });

    // Track visibility changes (user switching tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush(); // Flush events when user leaves
      }
    });

    // Batch flush events every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 10000);

    this.isInitialized = true;
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return this.generateSessionId();

    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get current tracking context
   */
  private getContext(): TrackingContext {
    if (typeof window === 'undefined') {
      return {
        sessionId: this.sessionId,
        pagePath: '',
        referrer: '',
        userAgent: '',
      };
    }

    return {
      sessionId: this.sessionId,
      pagePath: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Track an analytics event
   * Events are queued and flushed in batches for performance
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.isEnabled) return;

    // Add to queue for batch processing
    this.eventQueue.push(event);

    // If queue is large, flush immediately
    if (this.eventQueue.length >= 10) {
      await this.flush();
    }
  }

  /**
   * Flush queued events to database
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return; // Don't track unauthenticated actions

      const context = this.getContext();

      // Prepare batch insert
      const records = eventsToFlush.map(event => ({
        user_id: user.id,
        event_type: event.eventType,
        event_category: event.eventCategory,
        event_data: event.eventData || {},
        session_id: context.sessionId,
        page_path: context.pagePath,
        referrer: context.referrer,
        user_agent: context.userAgent,
        duration_ms: event.durationMs,
        error_message: event.errorMessage,
        success: event.success !== undefined ? event.success : true,
      }));

      const { error } = await this.supabase
        .from('analytics_events')
        .insert(records);

      if (error) {
        console.error('[Analytics] Failed to flush events:', error);
        // Re-queue events on failure
        this.eventQueue.unshift(...eventsToFlush);
      }
    } catch (error) {
      console.error('[Analytics] Flush error:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(pagePath: string, pageTitle?: string): Promise<void> {
    await this.track({
      eventType: 'page_viewed',
      eventCategory: 'navigation',
      eventData: {
        page_path: pagePath,
        page_title: pageTitle || document.title,
      },
    });
  }

  /**
   * Track user action with optional timing
   */
  async trackAction(
    eventType: EventType,
    eventCategory: EventCategory,
    data?: Record<string, any>,
    startTime?: number
  ): Promise<void> {
    const durationMs = startTime ? Date.now() - startTime : undefined;

    await this.track({
      eventType,
      eventCategory,
      eventData: data,
      durationMs,
    });
  }

  /**
   * Track error occurrence
   */
  async trackError(
    context: string,
    error: Error | string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'error_occurred',
      eventCategory: 'error',
      success: false,
      errorMessage: typeof error === 'string' ? error : error.message,
      eventData: {
        context,
        error_stack: typeof error === 'object' ? error.stack : undefined,
        ...additionalData,
      },
    });
  }

  /**
   * Track feature usage with timing
   */
  async trackFeature(
    featureName: string,
    action: string,
    data?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'feature_accessed',
      eventCategory: 'navigation',
      eventData: {
        feature_name: featureName,
        action,
        ...data,
      },
    });
  }

  /**
   * Track session start (login)
   */
  async trackSessionStart(method: string = 'email_password'): Promise<void> {
    this.pageLoadTime = Date.now();

    await this.track({
      eventType: 'login',
      eventCategory: 'authentication',
      eventData: {
        method,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track session end (page close/unload)
   * NOTE: This fires on beforeunload, which can trigger during navigation in SPAs.
   * For actual user logout, use trackLogout() instead.
   */
  private async trackSessionEnd(): Promise<void> {
    const sessionDuration = Date.now() - this.pageLoadTime;

    await this.track({
      eventType: 'session_end',
      eventCategory: 'navigation',
      durationMs: sessionDuration,
      eventData: {
        session_duration_ms: sessionDuration,
        session_duration_minutes: Math.round(sessionDuration / 60000),
        trigger: 'beforeunload',
      },
    });
  }

  /**
   * Track user logout (explicit logout action)
   * Call this from logout button/action handlers only
   */
  async trackLogout(): Promise<void> {
    const sessionDuration = Date.now() - this.pageLoadTime;

    await this.track({
      eventType: 'logout',
      eventCategory: 'authentication',
      durationMs: sessionDuration,
      eventData: {
        session_duration_ms: sessionDuration,
        session_duration_minutes: Math.round(sessionDuration / 60000),
        trigger: 'user_action',
      },
    });
  }

  /**
   * Track dialog/modal opening
   */
  async trackDialogOpen(dialogName: string, data?: Record<string, any>): Promise<void> {
    await this.track({
      eventType: 'dialog_opened',
      eventCategory: 'navigation',
      eventData: {
        dialog_name: dialogName,
        ...data,
      },
    });
  }

  /**
   * Start timing an operation
   */
  startTiming(): number {
    return Date.now();
  }

  /**
   * Enable/disable analytics tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Get enabled status
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Force flush all pending events (useful before page unload)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Cleanup on service destruction
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Convenience export for types
export type { AnalyticsEvent };

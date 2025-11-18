/**
 * Analytics Data Service
 *
 * Service for querying and aggregating analytics data for the usage dashboard
 * Provides insights into user behavior, feature usage, and engagement metrics
 */

import { createClient } from '@/lib/supabase/client';

export interface DashboardSummary {
  totalUsers: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionDuration: number;
  totalSessions: number;
  errorRate: number;
  totalErrors: number;
  newUsersLast30Days: number;
  newUsersLast7Days: number;
}

export interface UserAnalytics {
  user_id: string;
  email: string;
  display_name?: string;
  signup_date: string;
  last_login?: string;
  last_activity?: string;
  total_sessions: number;
  total_pins: number;
  total_lines: number;
  total_areas: number;
  total_projects: number;
  total_files_uploaded: number;
  is_active: boolean;
  is_power_user: boolean;
  days_active: number;
}

export interface FeatureUsageStats {
  feature_name: string;
  date: string;
  total_users: number;
  total_events: number;
  unique_sessions: number;
  avg_duration_ms: number;
  error_rate: number;
}

export interface ErrorLog {
  id: string;
  user_id: string;
  event_type: string;
  error_message: string;
  timestamp: string;
  event_data: Record<string, any>;
  page_path: string;
}

export interface UserSessionEvent {
  id: string;
  event_type: string;
  event_category: string;
  timestamp: string;
  page_path: string;
  duration_ms?: number;
  event_data: Record<string, any>;
}

export interface UserSessionDetails {
  user: UserAnalytics;
  recentSessions: {
    session_id: string;
    start_time: string;
    end_time?: string;
    duration_ms: number;
    pages_visited: string[];
    events: UserSessionEvent[];
  }[];
  pageViews: { page: string; count: number; avg_duration_ms: number }[];
  filesViewed: { file_name: string; count: number; total_duration_ms: number }[];
  featuresUsed: { feature: string; count: number }[];
  totalEvents: number;
}

class AnalyticsDataService {
  private supabase = createClient();

  /**
   * Get dashboard summary metrics
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get total users
      const { count: totalUsers } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true });

      // Get DAU (active today)
      const { count: dauCount } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', `${today}T00:00:00`)
        .lte('last_activity', `${today}T23:59:59`);

      // Get WAU (active in last 7 days)
      const { count: wauCount } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', `${sevenDaysAgo}T00:00:00`);

      // Get MAU (active in last 30 days)
      const { count: mauCount } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', `${thirtyDaysAgo}T00:00:00`);

      // Get average session duration from today's metrics
      const { data: todayMetrics } = await this.supabase
        .from('user_daily_metrics')
        .select('total_sessions, total_session_duration_ms')
        .eq('date', today);

      const totalSessions = todayMetrics?.reduce((sum, m) => sum + m.total_sessions, 0) || 0;
      const totalDuration = todayMetrics?.reduce((sum, m) => sum + m.total_session_duration_ms, 0) || 0;
      const avgSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

      // Get error rate from today's events
      const { count: totalEvents } = await this.supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', `${today}T00:00:00`);

      const { count: totalErrors } = await this.supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('success', false)
        .gte('timestamp', `${today}T00:00:00`);

      const errorRate = totalEvents && totalEvents > 0 ? ((totalErrors || 0) / totalEvents) * 100 : 0;

      // Get new users in last 30 days
      const { count: newUsers30 } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('signup_date', `${thirtyDaysAgo}T00:00:00`);

      // Get new users in last 7 days
      const { count: newUsers7 } = await this.supabase
        .from('user_analytics_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('signup_date', `${sevenDaysAgo}T00:00:00`);

      return {
        totalUsers: totalUsers || 0,
        dailyActiveUsers: dauCount || 0,
        weeklyActiveUsers: wauCount || 0,
        monthlyActiveUsers: mauCount || 0,
        avgSessionDuration: Math.round(avgSessionDuration),
        totalSessions: totalSessions,
        errorRate: errorRate,
        totalErrors: totalErrors || 0,
        newUsersLast30Days: newUsers30 || 0,
        newUsersLast7Days: newUsers7 || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      // Return zeros on error
      return {
        totalUsers: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        avgSessionDuration: 0,
        totalSessions: 0,
        errorRate: 0,
        totalErrors: 0,
        newUsersLast30Days: 0,
        newUsersLast7Days: 0,
      };
    }
  }

  /**
   * Get paginated list of users with analytics data
   */
  async getUsersList(limit = 100, offset = 0, sortBy: 'last_activity' | 'signup_date' | 'total_sessions' = 'last_activity'): Promise<UserAnalytics[]> {
    const { data, error } = await this.supabase
      .from('user_analytics_profiles')
      .select('*')
      .order(sortBy, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching users list:', error);
      return [];
    }

    return data as UserAnalytics[] || [];
  }

  /**
   * Get timeline of events for a specific user
   */
  async getUserTimeline(userId: string, days = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching user timeline:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsageStats(days = 30): Promise<FeatureUsageStats[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('feature_usage_metrics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('total_events', { ascending: false });

    if (error) {
      console.error('Error fetching feature usage stats:', error);
      return [];
    }

    return data as FeatureUsageStats[] || [];
  }

  /**
   * Get recent error logs
   */
  async getErrorLog(limit = 100): Promise<ErrorLog[]> {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('id, user_id, event_type, error_message, timestamp, event_data, page_path')
      .eq('success', false)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching error log:', error);
      return [];
    }

    return data as ErrorLog[] || [];
  }

  /**
   * Get daily active users trend (last N days)
   */
  async getDAUTrend(days = 30): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate daily active users by counting unique users per day
    const { data, error } = await this.supabase
      .from('user_daily_metrics')
      .select('date')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching DAU trend:', error);
      return [];
    }

    // Group by date and count unique users
    const dailyCounts = (data || []).reduce((acc, row) => {
      const date = row.date;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    }));
  }

  /**
   * Get top features by usage
   */
  async getTopFeatures(limit = 10): Promise<{ feature: string; usage: number }[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('feature_usage_metrics')
      .select('feature_name, total_events')
      .gte('date', thirtyDaysAgo)
      .order('total_events', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top features:', error);
      return [];
    }

    // Aggregate by feature name
    const featureMap = (data || []).reduce((acc, row) => {
      acc[row.feature_name] = (acc[row.feature_name] || 0) + row.total_events;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(featureMap)
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, limit);
  }

  /**
   * Search users by email or name
   */
  async searchUsers(query: string, limit = 50): Promise<UserAnalytics[]> {
    const { data, error} = await this.supabase
      .from('user_analytics_profiles')
      .select('*')
      .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
      .order('last_activity', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return data as UserAnalytics[] || [];
  }

  /**
   * Get detailed session information for a specific user
   */
  async getUserSessionDetails(userId: string, days = 30): Promise<UserSessionDetails | null> {
    try {
      // Get user profile
      const { data: userProfile } = await this.supabase
        .from('user_analytics_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!userProfile) return null;

      // Get all events for the user
      const timeline = await this.getUserTimeline(userId, days);

      // Group events by session_id
      const sessionMap: Record<string, UserSessionEvent[]> = {};
      timeline.forEach(event => {
        const sessionId = event.session_id || 'unknown';
        if (!sessionMap[sessionId]) {
          sessionMap[sessionId] = [];
        }
        sessionMap[sessionId].push({
          id: event.id,
          event_type: event.event_type,
          event_category: event.event_category,
          timestamp: event.timestamp,
          page_path: event.page_path,
          duration_ms: event.duration_ms,
          event_data: event.event_data || {},
        });
      });

      // Build session details
      const sessions = Object.entries(sessionMap).map(([session_id, events]) => {
        const sortedEvents = events.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const start_time = sortedEvents[0]?.timestamp || '';
        const end_time = sortedEvents[sortedEvents.length - 1]?.timestamp || '';
        const duration_ms = end_time && start_time
          ? new Date(end_time).getTime() - new Date(start_time).getTime()
          : 0;

        const pages_visited = [...new Set(sortedEvents.map(e => e.page_path).filter(Boolean))];

        return {
          session_id,
          start_time,
          end_time,
          duration_ms,
          pages_visited,
          events: sortedEvents,
        };
      }).sort((a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      ).slice(0, 10); // Keep last 10 sessions

      // Aggregate page views
      const pageViewMap: Record<string, { count: number; durations: number[] }> = {};
      timeline.forEach(event => {
        if (event.event_type === 'page_viewed' && event.page_path) {
          if (!pageViewMap[event.page_path]) {
            pageViewMap[event.page_path] = { count: 0, durations: [] };
          }
          pageViewMap[event.page_path].count++;
          if (event.duration_ms) {
            pageViewMap[event.page_path].durations.push(event.duration_ms);
          }
        }
      });

      const pageViews = Object.entries(pageViewMap).map(([page, data]) => ({
        page,
        count: data.count,
        avg_duration_ms: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
      })).sort((a, b) => b.count - a.count);

      // Aggregate file views
      const fileViewMap: Record<string, { count: number; total_duration_ms: number }> = {};
      timeline.forEach(event => {
        if (event.event_type === 'file_viewed' && event.event_data?.file_name) {
          const fileName = event.event_data.file_name;
          if (!fileViewMap[fileName]) {
            fileViewMap[fileName] = { count: 0, total_duration_ms: 0 };
          }
          fileViewMap[fileName].count++;
        } else if (event.event_type === 'file_view_ended' && event.event_data?.file_name) {
          const fileName = event.event_data.file_name;
          if (!fileViewMap[fileName]) {
            fileViewMap[fileName] = { count: 0, total_duration_ms: 0 };
          }
          fileViewMap[fileName].total_duration_ms += event.event_data.view_duration_ms || 0;
        }
      });

      const filesViewed = Object.entries(fileViewMap).map(([file_name, data]) => ({
        file_name,
        count: data.count,
        total_duration_ms: data.total_duration_ms,
      })).sort((a, b) => b.count - a.count);

      // Aggregate feature usage
      const featureMap: Record<string, number> = {};
      timeline.forEach(event => {
        if (event.event_type === 'feature_accessed' && event.event_data?.feature_name) {
          const feature = event.event_data.feature_name;
          featureMap[feature] = (featureMap[feature] || 0) + 1;
        }
      });

      const featuresUsed = Object.entries(featureMap).map(([feature, count]) => ({
        feature,
        count,
      })).sort((a, b) => b.count - a.count);

      return {
        user: userProfile as UserAnalytics,
        recentSessions: sessions,
        pageViews,
        filesViewed,
        featuresUsed,
        totalEvents: timeline.length,
      };
    } catch (error) {
      console.error('Error fetching user session details:', error);
      return null;
    }
  }
}

// Export singleton instance
export const analyticsDataService = new AnalyticsDataService();

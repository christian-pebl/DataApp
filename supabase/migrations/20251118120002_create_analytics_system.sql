-- Analytics System Migration
-- Creates comprehensive analytics tracking for user behavior and feature usage

-- =============================================
-- ANALYTICS EVENTS TABLE
-- Stores all user actions and interactions
-- =============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  page_path TEXT,
  referrer TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Performance tracking
  duration_ms INTEGER,
  error_message TEXT,
  success BOOLEAN DEFAULT true
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_success ON analytics_events(success) WHERE success = false;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category_time ON analytics_events(event_category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type, timestamp DESC);

-- =============================================
-- USER DAILY METRICS TABLE
-- Pre-aggregated daily metrics per user
-- =============================================
CREATE TABLE IF NOT EXISTS user_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Session metrics
  total_sessions INTEGER DEFAULT 0,
  total_session_duration_ms BIGINT DEFAULT 0,
  avg_session_duration_ms INTEGER DEFAULT 0,

  -- Action counts
  pins_created INTEGER DEFAULT 0,
  lines_created INTEGER DEFAULT 0,
  areas_created INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  files_downloaded INTEGER DEFAULT 0,
  visualizations_viewed INTEGER DEFAULT 0,
  shares_sent INTEGER DEFAULT 0,
  shares_accepted INTEGER DEFAULT 0,

  -- Quality metrics
  errors_encountered INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_user_date ON user_daily_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_date ON user_daily_metrics(date DESC);

-- =============================================
-- FEATURE USAGE METRICS TABLE
-- Aggregated feature usage statistics
-- =============================================
CREATE TABLE IF NOT EXISTS feature_usage_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_name TEXT NOT NULL,
  date DATE NOT NULL,

  -- Usage counts
  total_users INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,

  -- Performance
  avg_duration_ms INTEGER DEFAULT 0,
  p95_duration_ms INTEGER DEFAULT 0,
  error_rate DECIMAL(5,2) DEFAULT 0.00,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(feature_name, date)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_date ON feature_usage_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage_metrics(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_total_events ON feature_usage_metrics(total_events DESC);

-- =============================================
-- USER ANALYTICS PROFILES TABLE
-- Extended user profiles with analytics data
-- =============================================
CREATE TABLE IF NOT EXISTS user_analytics_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,

  -- Onboarding
  signup_date TIMESTAMPTZ,
  first_login TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,

  -- Engagement
  total_sessions INTEGER DEFAULT 0,
  total_session_duration_ms BIGINT DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,

  -- Usage totals
  total_pins INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  total_areas INTEGER DEFAULT 0,
  total_projects INTEGER DEFAULT 0,
  total_files_uploaded INTEGER DEFAULT 0,
  total_visualizations INTEGER DEFAULT 0,
  total_shares_sent INTEGER DEFAULT 0,
  total_shares_received INTEGER DEFAULT 0,

  -- Preferences
  favorite_features JSONB DEFAULT '[]'::jsonb,
  most_used_page TEXT,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  is_power_user BOOLEAN DEFAULT false,
  churn_risk_score DECIMAL(3,2) DEFAULT 0.00,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_analytics_last_activity ON user_analytics_profiles(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_signup_date ON user_analytics_profiles(signup_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_is_active ON user_analytics_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_analytics_is_power_user ON user_analytics_profiles(is_power_user);
CREATE INDEX IF NOT EXISTS idx_user_analytics_days_active ON user_analytics_profiles(days_active DESC);

-- =============================================
-- ADD is_admin FLAG TO user_profiles
-- =============================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all analytics tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics_profiles ENABLE ROW LEVEL SECURITY;

-- Analytics Events Policies
DROP POLICY IF EXISTS "Users can insert their own analytics events" ON analytics_events;
CREATE POLICY "Users can insert their own analytics events" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own analytics events" ON analytics_events;
CREATE POLICY "Users can view their own analytics events" ON analytics_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all analytics events" ON analytics_events;
CREATE POLICY "Admins can view all analytics events" ON analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- User Daily Metrics Policies
DROP POLICY IF EXISTS "Users can view their own daily metrics" ON user_daily_metrics;
CREATE POLICY "Users can view their own daily metrics" ON user_daily_metrics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all daily metrics" ON user_daily_metrics;
CREATE POLICY "Admins can view all daily metrics" ON user_daily_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "System can insert daily metrics" ON user_daily_metrics;
CREATE POLICY "System can insert daily metrics" ON user_daily_metrics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update daily metrics" ON user_daily_metrics;
CREATE POLICY "System can update daily metrics" ON user_daily_metrics
  FOR UPDATE USING (true);

-- Feature Usage Metrics Policies
DROP POLICY IF EXISTS "Admins can view feature metrics" ON feature_usage_metrics;
CREATE POLICY "Admins can view feature metrics" ON feature_usage_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "System can insert feature metrics" ON feature_usage_metrics;
CREATE POLICY "System can insert feature metrics" ON feature_usage_metrics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update feature metrics" ON feature_usage_metrics;
CREATE POLICY "System can update feature metrics" ON feature_usage_metrics
  FOR UPDATE USING (true);

-- User Analytics Profiles Policies
DROP POLICY IF EXISTS "Users can view their own analytics profile" ON user_analytics_profiles;
CREATE POLICY "Users can view their own analytics profile" ON user_analytics_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all analytics profiles" ON user_analytics_profiles;
CREATE POLICY "Admins can view all analytics profiles" ON user_analytics_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "System can insert analytics profiles" ON user_analytics_profiles;
CREATE POLICY "System can insert analytics profiles" ON user_analytics_profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update analytics profiles" ON user_analytics_profiles;
CREATE POLICY "System can update analytics profiles" ON user_analytics_profiles
  FOR UPDATE USING (true);

-- =============================================
-- AGGREGATION FUNCTIONS
-- =============================================

-- Function to calculate daily user metrics
CREATE OR REPLACE FUNCTION aggregate_user_daily_metrics(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO user_daily_metrics (
    user_id,
    date,
    total_sessions,
    pins_created,
    lines_created,
    areas_created,
    files_uploaded,
    files_downloaded,
    visualizations_viewed,
    shares_sent,
    shares_accepted,
    errors_encountered,
    success_rate
  )
  SELECT
    user_id,
    target_date,
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'login'),
    COUNT(*) FILTER (WHERE event_type = 'pin_created'),
    COUNT(*) FILTER (WHERE event_type = 'line_created'),
    COUNT(*) FILTER (WHERE event_type = 'area_created'),
    COUNT(*) FILTER (WHERE event_type = 'file_uploaded'),
    COUNT(*) FILTER (WHERE event_type = 'file_downloaded'),
    COUNT(*) FILTER (WHERE event_category = 'visualization'),
    COUNT(*) FILTER (WHERE event_type = 'share_created'),
    COUNT(*) FILTER (WHERE event_type = 'share_accepted'),
    COUNT(*) FILTER (WHERE success = false),
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100
      ELSE 100.00
    END
  FROM analytics_events
  WHERE DATE(timestamp) = target_date
  GROUP BY user_id
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    pins_created = EXCLUDED.pins_created,
    lines_created = EXCLUDED.lines_created,
    areas_created = EXCLUDED.areas_created,
    files_uploaded = EXCLUDED.files_uploaded,
    files_downloaded = EXCLUDED.files_downloaded,
    visualizations_viewed = EXCLUDED.visualizations_viewed,
    shares_sent = EXCLUDED.shares_sent,
    shares_accepted = EXCLUDED.shares_accepted,
    errors_encountered = EXCLUDED.errors_encountered,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate feature usage metrics
CREATE OR REPLACE FUNCTION aggregate_feature_usage_metrics(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO feature_usage_metrics (
    feature_name,
    date,
    total_users,
    total_events,
    unique_sessions,
    avg_duration_ms,
    error_rate
  )
  SELECT
    event_type as feature_name,
    target_date,
    COUNT(DISTINCT user_id),
    COUNT(*),
    COUNT(DISTINCT session_id),
    AVG(duration_ms)::INTEGER,
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE success = false)::DECIMAL / COUNT(*)) * 100
      ELSE 0.00
    END
  FROM analytics_events
  WHERE DATE(timestamp) = target_date
  GROUP BY event_type
  ON CONFLICT (feature_name, date)
  DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_events = EXCLUDED.total_events,
    unique_sessions = EXCLUDED.unique_sessions,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    error_rate = EXCLUDED.error_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update user analytics profiles
CREATE OR REPLACE FUNCTION update_user_analytics_profiles()
RETURNS void AS $$
BEGIN
  -- Insert or update user analytics profiles
  INSERT INTO user_analytics_profiles (
    user_id,
    email,
    signup_date,
    first_login,
    last_login,
    last_activity,
    total_pins,
    total_lines,
    total_areas,
    total_projects,
    total_files_uploaded,
    total_sessions
  )
  SELECT
    u.id,
    u.email,
    u.created_at,
    (SELECT MIN(timestamp) FROM analytics_events WHERE user_id = u.id AND event_type = 'login'),
    (SELECT MAX(timestamp) FROM analytics_events WHERE user_id = u.id AND event_type = 'login'),
    (SELECT MAX(timestamp) FROM analytics_events WHERE user_id = u.id),
    COALESCE((SELECT COUNT(*) FROM pins WHERE user_id = u.id::text), 0),
    COALESCE((SELECT COUNT(*) FROM lines WHERE user_id = u.id::text), 0),
    COALESCE((SELECT COUNT(*) FROM areas WHERE user_id = u.id::text), 0),
    COALESCE((SELECT COUNT(*) FROM projects WHERE user_id = u.id::text), 0),
    (SELECT COUNT(*) FROM analytics_events WHERE user_id = u.id AND event_type = 'file_uploaded'),
    (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE user_id = u.id)
  FROM auth.users u
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    last_login = EXCLUDED.last_login,
    last_activity = EXCLUDED.last_activity,
    total_pins = EXCLUDED.total_pins,
    total_lines = EXCLUDED.total_lines,
    total_areas = EXCLUDED.total_areas,
    total_projects = EXCLUDED.total_projects,
    total_files_uploaded = EXCLUDED.total_files_uploaded,
    total_sessions = EXCLUDED.total_sessions,
    updated_at = NOW();

  -- Mark power users (users with 10+ pins or 5+ files uploaded)
  UPDATE user_analytics_profiles
  SET is_power_user = true
  WHERE total_pins >= 10 OR total_files_uploaded >= 5;

  -- Mark inactive users (no activity in 30 days)
  UPDATE user_analytics_profiles
  SET is_active = false
  WHERE last_activity < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_daily_metrics_updated_at ON user_daily_metrics;
CREATE TRIGGER update_user_daily_metrics_updated_at
    BEFORE UPDATE ON user_daily_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_usage_metrics_updated_at ON feature_usage_metrics;
CREATE TRIGGER update_feature_usage_metrics_updated_at
    BEFORE UPDATE ON feature_usage_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_analytics_profiles_updated_at ON user_analytics_profiles;
CREATE TRIGGER update_user_analytics_profiles_updated_at
    BEFORE UPDATE ON user_analytics_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INITIAL DATA SYNC
-- =============================================

-- Note: Initial data sync removed due to mixed user_id types in legacy tables
-- Analytics profiles will be populated as users interact with the app
-- You can manually sync existing users by calling: SELECT update_user_analytics_profiles();

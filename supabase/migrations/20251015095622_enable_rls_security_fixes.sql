-- Migration: Enable RLS on public tables
-- Date: 2025-10-15
-- Purpose: Fix security issues identified by Supabase Database Linter
--
-- Security Issues Addressed:
-- 1. policy_exists_rls_disabled: Table 'lines' has RLS policies but RLS is not enabled
-- 2. rls_disabled_in_public: 10 tables are public but RLS has not been enabled
--
-- Tables affected:
-- - lines (has policies, needs RLS enabled)
-- - notifications, pin_files, projects, areas, pin_tags, line_tags, area_tags, tags, invitations

-- Enable RLS on lines table (already has policies)
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pin_files table
ALTER TABLE public.pin_files ENABLE ROW LEVEL SECURITY;

-- Enable RLS on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on areas table
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pin_tags table
ALTER TABLE public.pin_tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on line_tags table
ALTER TABLE public.line_tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on area_tags table
ALTER TABLE public.area_tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on invitations table
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Note: Tables that already have policies defined (like 'lines') will maintain those policies.
-- Tables without policies will now be protected by RLS but will need policies added in subsequent migrations
-- to allow appropriate access patterns.

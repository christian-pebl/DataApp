-- Migration: Add active_project_id preference to user_profiles table
-- This allows users to return to their last active project when they log back in

-- Add the active_project_id column to store user's preferred active project
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS active_project_id TEXT DEFAULT NULL;

-- Create an index for better performance when querying active projects
CREATE INDEX IF NOT EXISTS idx_user_profiles_active_project 
ON public.user_profiles(active_project_id);

-- Add a comment explaining the column purpose
COMMENT ON COLUMN public.user_profiles.active_project_id 
IS 'Stores the users last active project ID for session persistence';

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND table_schema = 'public' 
  AND column_name = 'active_project_id';
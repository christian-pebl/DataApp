-- Create user_profiles table with active_project_id support
-- This table stores user preferences including their last active project

-- First, create the user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    active_project_id TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active_project ON public.user_profiles(active_project_id);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All users can view user profiles" ON public.user_profiles
FOR SELECT USING (true);

CREATE POLICY "Users can manage their own profile" ON public.user_profiles
FOR ALL USING (auth.uid() = id);

-- Add a comment explaining the active_project_id column
COMMENT ON COLUMN public.user_profiles.active_project_id 
IS 'Stores the users last active project ID for session persistence';

-- Verify the table was created successfully
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
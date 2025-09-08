-- RLS Policies for pins table
-- Copy and paste this entire content into Supabase SQL Editor and run it

-- First, make sure RLS is enabled on pins table (this is safe to run multiple times)
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own pins" ON pins;
DROP POLICY IF EXISTS "Users can insert their own pins" ON pins;
DROP POLICY IF EXISTS "Users can update their own pins" ON pins;
DROP POLICY IF EXISTS "Users can delete their own pins" ON pins;

-- Create new RLS policies for pins table
CREATE POLICY "Users can view their own pins" ON pins 
FOR SELECT USING (user_id::text = auth.uid());

CREATE POLICY "Users can insert their own pins" ON pins 
FOR INSERT WITH CHECK (user_id::text = auth.uid());

CREATE POLICY "Users can update their own pins" ON pins 
FOR UPDATE USING (user_id::text = auth.uid());

CREATE POLICY "Users can delete their own pins" ON pins 
FOR DELETE USING (user_id::text = auth.uid());

-- Test the policies (this should return no rows if RLS is working)
SELECT 'RLS policies created successfully' as status;
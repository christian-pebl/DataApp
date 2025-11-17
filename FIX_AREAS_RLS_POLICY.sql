-- Fix RLS policy for areas table to allow new visual property columns
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own areas" ON areas;
DROP POLICY IF EXISTS "Users can view their own areas" ON areas;
DROP POLICY IF EXISTS "Users can update their own areas" ON areas;
DROP POLICY IF EXISTS "Users can delete their own areas" ON areas;

-- Recreate INSERT policy (allows all columns including color, size, transparency)
CREATE POLICY "Users can insert their own areas"
ON areas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = user_id
);

-- Recreate SELECT policy
CREATE POLICY "Users can view their own areas"
ON areas
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = user_id
);

-- Recreate UPDATE policy (allows updating all columns)
CREATE POLICY "Users can update their own areas"
ON areas
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Recreate DELETE policy
CREATE POLICY "Users can delete their own areas"
ON areas
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- Verify RLS is enabled
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'areas';

-- Fix RLS policies for pin_files table to allow authenticated users to insert
-- Issue: Users can upload to storage but get 403 when inserting metadata
-- Fix: Added type casting to handle UUID vs TEXT comparison

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can view their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can update their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can delete their own pin files" ON pin_files;

-- Enable RLS on pin_files table
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow users to INSERT files for pins they own
CREATE POLICY "Users can insert their own pin files"
ON pin_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()::text
  )
);

-- Policy 2: Allow users to SELECT/VIEW files for pins they own
CREATE POLICY "Users can view their own pin files"
ON pin_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()::text
  )
);

-- Policy 3: Allow users to UPDATE files for pins they own
CREATE POLICY "Users can update their own pin files"
ON pin_files
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()::text
  )
);

-- Policy 4: Allow users to DELETE files for pins they own
CREATE POLICY "Users can delete their own pin files"
ON pin_files
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()::text
  )
);

-- Grant necessary permissions
GRANT ALL ON pin_files TO authenticated;
GRANT USAGE ON SEQUENCE pin_files_id_seq TO authenticated;

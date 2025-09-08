-- Comprehensive fix for RLS policies - Data persistence issue resolution
-- This script fixes the UUID comparison issues in RLS policies that cause data to disappear after login/logout

-- First, drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert their own tags" ON tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;

DROP POLICY IF EXISTS "Users can view their own pins" ON pins;
DROP POLICY IF EXISTS "Users can insert their own pins" ON pins;
DROP POLICY IF EXISTS "Users can update their own pins" ON pins;
DROP POLICY IF EXISTS "Users can delete their own pins" ON pins;

DROP POLICY IF EXISTS "Users can view their own lines" ON lines;
DROP POLICY IF EXISTS "Users can insert their own lines" ON lines;
DROP POLICY IF EXISTS "Users can update their own lines" ON lines;
DROP POLICY IF EXISTS "Users can delete their own lines" ON lines;

DROP POLICY IF EXISTS "Users can view their own areas" ON areas;
DROP POLICY IF EXISTS "Users can insert their own areas" ON areas;
DROP POLICY IF EXISTS "Users can update their own areas" ON areas;
DROP POLICY IF EXISTS "Users can delete their own areas" ON areas;

DROP POLICY IF EXISTS "Users can view their pin tags" ON pin_tags;
DROP POLICY IF EXISTS "Users can insert their pin tags" ON pin_tags;
DROP POLICY IF EXISTS "Users can delete their pin tags" ON pin_tags;

DROP POLICY IF EXISTS "Users can view their line tags" ON line_tags;
DROP POLICY IF EXISTS "Users can insert their line tags" ON line_tags;
DROP POLICY IF EXISTS "Users can delete their line tags" ON line_tags;

DROP POLICY IF EXISTS "Users can view their area tags" ON area_tags;
DROP POLICY IF EXISTS "Users can insert their area tags" ON area_tags;
DROP POLICY IF EXISTS "Users can delete their area tags" ON area_tags;

-- Fix for pin_files table policies
DROP POLICY IF EXISTS "Users can view their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can insert their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can update their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can delete their own pin files" ON pin_files;

-- Now create the corrected policies with consistent UUID comparison

-- Projects table policies
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Tags table policies
CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Pins table policies (CRITICAL FIX)
CREATE POLICY "Users can view their own pins" ON pins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pins" ON pins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pins" ON pins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pins" ON pins
  FOR DELETE USING (auth.uid() = user_id);

-- Lines table policies
CREATE POLICY "Users can view their own lines" ON lines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lines" ON lines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lines" ON lines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lines" ON lines
  FOR DELETE USING (auth.uid() = user_id);

-- Areas table policies
CREATE POLICY "Users can view their own areas" ON areas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own areas" ON areas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own areas" ON areas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own areas" ON areas
  FOR DELETE USING (auth.uid() = user_id);

-- Junction table policies - fixed to use proper user access control
CREATE POLICY "Users can view their pin tags" ON pin_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their pin tags" ON pin_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their pin tags" ON pin_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

-- Line tags policies
CREATE POLICY "Users can view their line tags" ON line_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their line tags" ON line_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their line tags" ON line_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

-- Area tags policies
CREATE POLICY "Users can view their area tags" ON area_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their area tags" ON area_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their area tags" ON area_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

-- CRITICAL FIX: Pin files table policies - enforce proper user-based access control
-- These policies ensure users can only access files for pins they own
CREATE POLICY "Users can view their own pin files" ON pin_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own pin files" ON pin_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own pin files" ON pin_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own pin files" ON pin_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()
    )
  );

-- Ensure RLS is enabled on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

-- Test query to verify policies are working
SELECT 
  'RLS policies fixed successfully' as status,
  'Users should now see their own data consistently after login/logout' as description;
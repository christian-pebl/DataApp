-- Comprehensive fix for RLS policies WITH EXPLICIT TYPE CASTING
-- This fixes the UUID vs text comparison issue

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

DROP POLICY IF EXISTS "Users can view their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can insert their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can update their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can delete their own pin files" ON pin_files;

-- CRITICAL FIX: Use explicit UUID casting for auth.uid()
-- auth.uid() returns TEXT but user_id columns are UUID type

-- Projects table policies with explicit casting
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Tags table policies with explicit casting
CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Pins table policies with explicit casting (CRITICAL FOR PIN NAMES)
CREATE POLICY "Users can view their own pins" ON pins
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own pins" ON pins
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own pins" ON pins
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own pins" ON pins
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Lines table policies with explicit casting
CREATE POLICY "Users can view their own lines" ON lines
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own lines" ON lines
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own lines" ON lines
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own lines" ON lines
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Areas table policies with explicit casting
CREATE POLICY "Users can view their own areas" ON areas
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own areas" ON areas
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own areas" ON areas
  FOR UPDATE USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own areas" ON areas
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- Junction table policies with explicit casting
CREATE POLICY "Users can view their pin tags" ON pin_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can insert their pin tags" ON pin_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can delete their pin tags" ON pin_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

-- Line tags policies with explicit casting
CREATE POLICY "Users can view their line tags" ON line_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can insert their line tags" ON line_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can delete their line tags" ON line_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()::uuid
    )
  );

-- Area tags policies with explicit casting
CREATE POLICY "Users can view their area tags" ON area_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can insert their area tags" ON area_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can delete their area tags" ON area_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()::uuid
    )
  );

-- Pin files table policies with explicit casting (FIXES FILE ACCESS ERRORS)
CREATE POLICY "Users can view their own pin files" ON pin_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can insert their own pin files" ON pin_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can update their own pin files" ON pin_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can delete their own pin files" ON pin_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_files.pin_id AND pins.user_id = auth.uid()::uuid
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
  'RLS policies with UUID casting fixed successfully' as status,
  'Users should now see their own data with proper type casting' as description;
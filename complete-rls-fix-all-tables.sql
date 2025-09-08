-- COMPLETE RLS FIX FOR ALL REMAINING TABLES
-- Run this AFTER the pins table fix to complete the setup

-- First check if pin_files table exists and has correct structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pin_files') THEN
        CREATE TABLE pin_files (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            file_type TEXT,
            uploaded_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Disable RLS first to clear any issues
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;

-- Drop existing policies on these tables
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('projects', 'tags', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- PROJECTS table policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "projects_insert" ON projects
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "projects_update" ON projects
    FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "projects_delete" ON projects
    FOR DELETE USING (user_id::text = auth.uid()::text);

-- TAGS table policies
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON tags
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "tags_insert" ON tags
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "tags_update" ON tags
    FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "tags_delete" ON tags
    FOR DELETE USING (user_id::text = auth.uid()::text);

-- LINES table policies
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lines_select" ON lines
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "lines_insert" ON lines
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "lines_update" ON lines
    FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "lines_delete" ON lines
    FOR DELETE USING (user_id::text = auth.uid()::text);

-- AREAS table policies
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select" ON areas
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "areas_insert" ON areas
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "areas_update" ON areas
    FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "areas_delete" ON areas
    FOR DELETE USING (user_id::text = auth.uid()::text);

-- PIN_FILES table policies (CRITICAL FOR FILE ACCESS)
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_files_select" ON pin_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "pin_files_insert" ON pin_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "pin_files_update" ON pin_files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "pin_files_delete" ON pin_files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- PIN_TAGS junction table policies
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_tags_select" ON pin_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "pin_tags_insert" ON pin_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "pin_tags_delete" ON pin_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- LINE_TAGS junction table policies
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_tags_select" ON line_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "line_tags_insert" ON line_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "line_tags_delete" ON line_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

-- AREA_TAGS junction table policies
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "area_tags_select" ON area_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "area_tags_insert" ON area_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "area_tags_delete" ON area_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

-- Verify all policies are created
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files')
GROUP BY tablename
ORDER BY tablename;

-- Final status
SELECT 
    'ALL RLS POLICIES APPLIED SUCCESSFULLY' as status,
    'All tables now have proper RLS with text comparison' as description;
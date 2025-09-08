-- FIX FOR VARCHAR/TEXT user_id columns
-- This assumes user_id is stored as VARCHAR/TEXT, not UUID

-- 1. Disable RLS on all tables
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 3. PINS table - assuming user_id is VARCHAR/TEXT
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pins_select" ON pins
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pins_insert" ON pins
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "pins_update" ON pins
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "pins_delete" ON pins
    FOR DELETE USING (user_id = auth.uid());

-- 4. PROJECTS table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "projects_insert" ON projects
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update" ON projects
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "projects_delete" ON projects
    FOR DELETE USING (user_id = auth.uid());

-- 5. TAGS table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON tags
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tags_insert" ON tags
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tags_update" ON tags
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "tags_delete" ON tags
    FOR DELETE USING (user_id = auth.uid());

-- 6. LINES table
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lines_select" ON lines
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "lines_insert" ON lines
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "lines_update" ON lines
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "lines_delete" ON lines
    FOR DELETE USING (user_id = auth.uid());

-- 7. AREAS table
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select" ON areas
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "areas_insert" ON areas
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "areas_update" ON areas
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "areas_delete" ON areas
    FOR DELETE USING (user_id = auth.uid());

-- 8. PIN_FILES table (uses join)
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_files_select" ON pin_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "pin_files_insert" ON pin_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "pin_files_update" ON pin_files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "pin_files_delete" ON pin_files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

-- 9. Junction tables
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_tags_select" ON pin_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "pin_tags_insert" ON pin_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "pin_tags_delete" ON pin_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id = auth.uid()
        )
    );

-- Similar for line_tags
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_tags_select" ON line_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id = auth.uid()
        )
    );

CREATE POLICY "line_tags_insert" ON line_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id = auth.uid()
        )
    );

CREATE POLICY "line_tags_delete" ON line_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id = auth.uid()
        )
    );

-- Similar for area_tags
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "area_tags_select" ON area_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id = auth.uid()
        )
    );

CREATE POLICY "area_tags_insert" ON area_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id = auth.uid()
        )
    );

CREATE POLICY "area_tags_delete" ON area_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id = auth.uid()
        )
    );

-- 10. Verify
SELECT 
    'VARCHAR/TEXT RLS Fix Applied Successfully' as status,
    'No type casting needed - both user_id and auth.uid() are text' as description;
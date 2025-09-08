-- FINAL DEFINITIVE RLS FIX
-- This handles the UUID/TEXT comparison properly

-- STEP 1: Disable RLS temporarily to clear everything
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- STEP 3: Create policies for PINS table with PROPER casting
-- Both sides need to be the same type - we'll use TEXT
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_pins" ON pins
    FOR SELECT 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_insert_own_pins" ON pins
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "allow_update_own_pins" ON pins
    FOR UPDATE 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_delete_own_pins" ON pins
    FOR DELETE 
    USING (user_id::text = auth.uid()::text);

-- STEP 4: Create policies for PROJECTS table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_projects" ON projects
    FOR SELECT 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_insert_own_projects" ON projects
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "allow_update_own_projects" ON projects
    FOR UPDATE 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_delete_own_projects" ON projects
    FOR DELETE 
    USING (user_id::text = auth.uid()::text);

-- STEP 5: Create policies for TAGS table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_tags" ON tags
    FOR SELECT 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_insert_own_tags" ON tags
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "allow_update_own_tags" ON tags
    FOR UPDATE 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_delete_own_tags" ON tags
    FOR DELETE 
    USING (user_id::text = auth.uid()::text);

-- STEP 6: Create policies for LINES table
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_lines" ON lines
    FOR SELECT 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_insert_own_lines" ON lines
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "allow_update_own_lines" ON lines
    FOR UPDATE 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_delete_own_lines" ON lines
    FOR DELETE 
    USING (user_id::text = auth.uid()::text);

-- STEP 7: Create policies for AREAS table
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_areas" ON areas
    FOR SELECT 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_insert_own_areas" ON areas
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "allow_update_own_areas" ON areas
    FOR UPDATE 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "allow_delete_own_areas" ON areas
    FOR DELETE 
    USING (user_id::text = auth.uid()::text);

-- STEP 8: Create policies for PIN_FILES table
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_pin_files" ON pin_files
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_insert_own_pin_files" ON pin_files
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_update_own_pin_files" ON pin_files
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_delete_own_pin_files" ON pin_files
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- STEP 9: Create policies for junction tables
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_pin_tags" ON pin_tags
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_insert_own_pin_tags" ON pin_tags
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_delete_own_pin_tags" ON pin_tags
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- STEP 10: Similar for line_tags
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_line_tags" ON line_tags
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_insert_own_line_tags" ON line_tags
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_delete_own_line_tags" ON line_tags
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND lines.user_id::text = auth.uid()::text
        )
    );

-- STEP 11: Similar for area_tags
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_own_area_tags" ON area_tags
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_insert_own_area_tags" ON area_tags
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "allow_delete_own_area_tags" ON area_tags
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND areas.user_id::text = auth.uid()::text
        )
    );

-- STEP 12: Verify everything is working
SELECT 
    'FINAL RLS FIX APPLIED SUCCESSFULLY' as status,
    'Both UUID and TEXT are cast to TEXT for comparison' as method,
    COUNT(*) as total_policies_created
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files');
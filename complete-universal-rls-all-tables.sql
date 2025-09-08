-- COMPLETE UNIVERSAL RLS FIX FOR ALL REMAINING TABLES
-- Using CAST AS TEXT for all comparisons to ensure compatibility

-- 1. Disable RLS on remaining tables
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN ('projects', 'tags', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 3. PROJECTS table policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_projects_select" ON projects
    FOR SELECT USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_projects_insert" ON projects
    FOR INSERT WITH CHECK (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_projects_update" ON projects
    FOR UPDATE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_projects_delete" ON projects
    FOR DELETE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

-- 4. TAGS table policies
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_tags_select" ON tags
    FOR SELECT USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_tags_insert" ON tags
    FOR INSERT WITH CHECK (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_tags_update" ON tags
    FOR UPDATE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_tags_delete" ON tags
    FOR DELETE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

-- 5. LINES table policies
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_lines_select" ON lines
    FOR SELECT USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_lines_insert" ON lines
    FOR INSERT WITH CHECK (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_lines_update" ON lines
    FOR UPDATE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_lines_delete" ON lines
    FOR DELETE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

-- 6. AREAS table policies
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_areas_select" ON areas
    FOR SELECT USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_areas_insert" ON areas
    FOR INSERT WITH CHECK (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_areas_update" ON areas
    FOR UPDATE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_areas_delete" ON areas
    FOR DELETE USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

-- 7. PIN_TAGS junction table policies
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_pin_tags_select" ON pin_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_pin_tags_insert" ON pin_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_pin_tags_delete" ON pin_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_tags.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

-- 8. LINE_TAGS junction table policies
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_line_tags_select" ON line_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND CAST(lines.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_line_tags_insert" ON line_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND CAST(lines.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_line_tags_delete" ON line_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lines 
            WHERE lines.id = line_tags.line_id 
            AND CAST(lines.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

-- 9. AREA_TAGS junction table policies
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_area_tags_select" ON area_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND CAST(areas.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_area_tags_insert" ON area_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND CAST(areas.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_area_tags_delete" ON area_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM areas 
            WHERE areas.id = area_tags.area_id 
            AND CAST(areas.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

-- 10. Verify all policies are in place
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
    'ALL TABLES RLS POLICIES APPLIED SUCCESSFULLY' as status,
    'All tables now use universal CAST AS TEXT comparison' as description,
    'Your app should be fully functional now!' as result;
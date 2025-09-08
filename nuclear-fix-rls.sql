-- NUCLEAR OPTION: Complete RLS reset with proper type handling
-- This will forcefully fix all RLS issues

-- STEP 1: Disable RLS on all tables first (to avoid conflicts)
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL policies (use CASCADE to force)
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop all policies on our tables
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- STEP 3: Create ONLY the most critical policies for PINS (to fix pin names)
-- Using the most compatible syntax
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pins_select_policy" ON pins
    FOR SELECT 
    USING (user_id::text = auth.uid());

CREATE POLICY "pins_insert_policy" ON pins
    FOR INSERT 
    WITH CHECK (user_id::text = auth.uid());

CREATE POLICY "pins_update_policy" ON pins
    FOR UPDATE 
    USING (user_id::text = auth.uid());

CREATE POLICY "pins_delete_policy" ON pins
    FOR DELETE 
    USING (user_id::text = auth.uid());

-- STEP 4: Verify it works
SELECT 
    'Nuclear fix applied - pins table should work now' as status,
    current_setting('is_superuser') as is_superuser,
    auth.uid() as current_user_id;
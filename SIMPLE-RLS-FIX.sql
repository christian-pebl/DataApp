-- SIMPLE DIRECT RLS FIX
-- This uses the most straightforward approach

-- 1. Completely disable RLS on all tables
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS area_tags DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 3. Create simple policies for pins using CAST
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Simple approach: auth.uid() returns text, user_id is UUID
-- So we cast auth.uid() to UUID for comparison
CREATE POLICY "pins_all_operations" ON pins
    FOR ALL 
    USING (user_id = (auth.uid())::uuid)
    WITH CHECK (user_id = (auth.uid())::uuid);

-- 4. Create policies for pin_files
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_files_all_operations" ON pin_files
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = (auth.uid())::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id = (auth.uid())::uuid
        )
    );

-- 5. Test
SELECT 
    'Simple RLS Fix Applied' as status,
    'Using auth.uid()::uuid for comparison' as method;
-- DIAGNOSTIC AND FIX SCRIPT
-- First, let's check the actual data types

-- Step 1: Check what data type user_id actually is in the pins table
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'pins' 
AND column_name = 'user_id';

-- Step 2: Check what auth.uid() returns
SELECT 
    auth.uid() as user_id,
    pg_typeof(auth.uid()) as uid_type;

-- Step 3: Check if we can access pins with different casting methods
-- Try Method 1: Both as text
SELECT COUNT(*) as method1_count 
FROM pins 
WHERE user_id::text = auth.uid();

-- Try Method 2: Both as UUID (if auth.uid() can be cast to UUID)
SELECT COUNT(*) as method2_count 
FROM pins 
WHERE user_id = auth.uid()::uuid;

-- Step 4: Apply the working method as policies
-- First disable and clean
ALTER TABLE pins DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on pins
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'pins'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON pins', pol.policyname);
    END LOOP;
END $$;

-- Step 5: Create new policies using the correct casting
-- Since user_id is UUID and auth.uid() returns text, we need to cast auth.uid() to UUID
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pins_select_v2" ON pins
    FOR SELECT 
    USING (
        CASE 
            WHEN auth.uid() IS NULL THEN false
            WHEN auth.uid() = '' THEN false
            ELSE user_id = auth.uid()::uuid
        END
    );

CREATE POLICY "pins_insert_v2" ON pins
    FOR INSERT 
    WITH CHECK (
        CASE 
            WHEN auth.uid() IS NULL THEN false
            WHEN auth.uid() = '' THEN false
            ELSE user_id = auth.uid()::uuid
        END
    );

CREATE POLICY "pins_update_v2" ON pins
    FOR UPDATE 
    USING (
        CASE 
            WHEN auth.uid() IS NULL THEN false
            WHEN auth.uid() = '' THEN false
            ELSE user_id = auth.uid()::uuid
        END
    );

CREATE POLICY "pins_delete_v2" ON pins
    FOR DELETE 
    USING (
        CASE 
            WHEN auth.uid() IS NULL THEN false
            WHEN auth.uid() = '' THEN false
            ELSE user_id = auth.uid()::uuid
        END
    );

-- Step 6: Test if it works
SELECT 
    'Pins RLS Fixed with UUID casting' as status,
    COUNT(*) as accessible_pins
FROM pins;
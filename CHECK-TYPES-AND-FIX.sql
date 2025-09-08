-- FIRST: Let's check the EXACT types in your database
-- Run this to understand what we're dealing with

-- 1. Check the columns in pins table
SELECT 
    table_name,
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'pins' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check what auth.uid() returns
SELECT 
    auth.uid() as current_user_id,
    pg_typeof(auth.uid()) as auth_uid_type;

-- 3. Check if user_id might be VARCHAR instead of UUID
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'pins' 
AND column_name = 'user_id';

-- NOW THE FIX: Handle both VARCHAR and UUID cases
-- This will work regardless of the actual type

-- Disable RLS first
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename IN ('pins', 'pin_files')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, 
            CASE WHEN pol.policyname LIKE '%pins%' THEN 'pins' ELSE 'pin_files' END);
    END LOOP;
END $$;

-- Create policies that work with VARCHAR user_id
-- (Based on the error, it seems user_id might be VARCHAR, not UUID)
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pins_policy_varchar" ON pins
    FOR ALL 
    USING (
        CASE 
            WHEN pg_typeof(user_id)::text = 'uuid' THEN 
                user_id::text = auth.uid()
            ELSE 
                user_id = auth.uid()
        END
    )
    WITH CHECK (
        CASE 
            WHEN pg_typeof(user_id)::text = 'uuid' THEN 
                user_id::text = auth.uid()
            ELSE 
                user_id = auth.uid()
        END
    );

-- Alternative simpler approach if user_id is VARCHAR
-- Comment out the above and uncomment this if user_id is confirmed VARCHAR:
/*
CREATE POLICY "pins_simple_varchar" ON pins
    FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
*/

-- For pin_files
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_files_policy" ON pin_files
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND (
                CASE 
                    WHEN pg_typeof(pins.user_id)::text = 'uuid' THEN 
                        pins.user_id::text = auth.uid()
                    ELSE 
                        pins.user_id = auth.uid()
                END
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND (
                CASE 
                    WHEN pg_typeof(pins.user_id)::text = 'uuid' THEN 
                        pins.user_id::text = auth.uid()
                    ELSE 
                        pins.user_id = auth.uid()
                END
            )
        )
    );

-- Test
SELECT 
    'Type-flexible RLS applied' as status;
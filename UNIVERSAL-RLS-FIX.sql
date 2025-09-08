-- UNIVERSAL RLS FIX - Works with any type combination
-- This converts everything to TEXT for comparison

-- 1. Clean slate
ALTER TABLE IF EXISTS pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pin_files DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies on pins
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'pins'
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON pins', pol.policyname);
    END LOOP;
END $$;

-- 3. Drop ALL existing policies on pin_files
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'pin_files'
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON pin_files', pol.policyname);
    END LOOP;
END $$;

-- 4. Create universal policies for pins - ALWAYS cast to text
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_pins_select" ON pins
    FOR SELECT 
    USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_pins_insert" ON pins
    FOR INSERT 
    WITH CHECK (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_pins_update" ON pins
    FOR UPDATE 
    USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

CREATE POLICY "universal_pins_delete" ON pins
    FOR DELETE 
    USING (CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT));

-- 5. Create universal policies for pin_files
ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universal_pin_files_select" ON pin_files
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_pin_files_insert" ON pin_files
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_pin_files_update" ON pin_files
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

CREATE POLICY "universal_pin_files_delete" ON pin_files
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM pins 
            WHERE pins.id = pin_files.pin_id 
            AND CAST(pins.user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        )
    );

-- 6. Test
SELECT 
    'Universal RLS Fix Applied' as status,
    'Using CAST(... AS TEXT) for all comparisons' as method,
    'This works regardless of actual column types' as note;
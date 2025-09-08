-- Step-by-step RLS fix to identify which table is causing the issue
-- Run each section separately to identify the problem

-- STEP 1: Drop all existing policies (run this first)
DO $$ 
BEGIN
    -- Drop policies if they exist (ignore errors if they don't)
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some policies did not exist, continuing...';
END $$;

-- STEP 2: Check data types of all tables
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name = 'user_id'
    AND table_name IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_files')
ORDER BY table_name;

-- STEP 3: Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'tags', 'pins', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags', 'pin_files');

-- STEP 4: Create policies for PINS table only (most critical)
-- This uses the safest casting approach
CREATE POLICY "Users can view their own pins" ON pins
    FOR SELECT 
    USING (user_id = (auth.uid())::uuid);

CREATE POLICY "Users can insert their own pins" ON pins
    FOR INSERT 
    WITH CHECK (user_id = (auth.uid())::uuid);

CREATE POLICY "Users can update their own pins" ON pins
    FOR UPDATE 
    USING (user_id = (auth.uid())::uuid);

CREATE POLICY "Users can delete their own pins" ON pins
    FOR DELETE 
    USING (user_id = (auth.uid())::uuid);

-- STEP 5: Enable RLS on pins table
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- STEP 6: Test the pins policies
SELECT 
    'Pins policies created successfully' as status,
    COUNT(*) as pin_count
FROM pins
WHERE user_id = (auth.uid())::uuid;
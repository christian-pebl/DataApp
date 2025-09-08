-- DIAGNOSTIC: Find out EXACTLY what types we have

-- 1. Check the EXACT column types in pins table
SELECT 
    c.column_name,
    c.data_type,
    c.udt_name,
    CASE 
        WHEN c.data_type = 'USER-DEFINED' THEN t.typname
        ELSE c.data_type
    END as actual_type
FROM information_schema.columns c
LEFT JOIN pg_type t ON c.udt_name = t.typname
WHERE c.table_name = 'pins' 
AND c.table_schema = 'public'
AND c.column_name IN ('id', 'user_id', 'pin_id')
ORDER BY c.ordinal_position;

-- 2. Check what auth.uid() actually returns
DO $$
DECLARE
    uid_val text;
    uid_type text;
BEGIN
    uid_val := auth.uid();
    uid_type := pg_typeof(auth.uid())::text;
    RAISE NOTICE 'auth.uid() value: %, type: %', uid_val, uid_type;
END $$;

-- 3. Let's see the actual data and types
SELECT 
    id,
    user_id,
    pg_typeof(id) as id_type,
    pg_typeof(user_id) as user_id_type,
    length(user_id::text) as user_id_length
FROM pins
LIMIT 5;

-- 4. Try different comparison methods to see which works
DO $$
DECLARE
    test_result boolean;
BEGIN
    -- Test 1: Direct comparison
    BEGIN
        SELECT EXISTS(SELECT 1 FROM pins WHERE user_id = auth.uid()) INTO test_result;
        RAISE NOTICE 'Test 1 (user_id = auth.uid()): SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Test 1 (user_id = auth.uid()): FAILED - %', SQLERRM;
    END;
    
    -- Test 2: Cast user_id to text
    BEGIN
        SELECT EXISTS(SELECT 1 FROM pins WHERE user_id::text = auth.uid()) INTO test_result;
        RAISE NOTICE 'Test 2 (user_id::text = auth.uid()): SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Test 2 (user_id::text = auth.uid()): FAILED - %', SQLERRM;
    END;
    
    -- Test 3: Cast auth.uid() to user_id type
    BEGIN
        SELECT EXISTS(SELECT 1 FROM pins WHERE user_id = auth.uid()::uuid) INTO test_result;
        RAISE NOTICE 'Test 3 (user_id = auth.uid()::uuid): SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Test 3 (user_id = auth.uid()::uuid): FAILED - %', SQLERRM;
    END;
    
    -- Test 4: Cast both to text
    BEGIN
        SELECT EXISTS(SELECT 1 FROM pins WHERE user_id::text = auth.uid()::text) INTO test_result;
        RAISE NOTICE 'Test 4 (user_id::text = auth.uid()::text): SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Test 4 (user_id::text = auth.uid()::text): FAILED - %', SQLERRM;
    END;
END $$;

-- 5. Show the actual SQL that would work
SELECT 
    'Run the diagnostic above to see which comparison method works' as instruction,
    'The NOTICE messages will show which test succeeds' as next_step;
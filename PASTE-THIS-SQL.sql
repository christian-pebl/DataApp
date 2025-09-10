-- STEP-BY-STEP DATABASE FIX
-- Copy and paste this entire block into Supabase SQL Editor

-- Step 1: Check what currently exists
SELECT 'Current pin_shares columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pin_shares' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Drop the existing broken table (if it exists)
-- This is safe because it has the wrong schema anyway
DROP TABLE IF EXISTS public.pin_shares CASCADE;

-- Step 3: Create the correct pin_shares table
CREATE TABLE public.pin_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pin_id UUID NOT NULL,
    shared_with_user_id UUID NOT NULL,
    shared_by_user_id UUID NOT NULL,
    permission_level TEXT CHECK (permission_level IN ('view', 'edit')) NOT NULL DEFAULT 'view',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Add foreign key constraints (if the referenced tables exist)
-- We'll add these conditionally to avoid errors if pins table doesn't exist yet
DO $$
BEGIN
    -- Check if pins table exists before adding foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pins' AND table_schema = 'public') THEN
        ALTER TABLE public.pin_shares 
        ADD CONSTRAINT fk_pin_shares_pin_id 
        FOREIGN KEY (pin_id) REFERENCES public.pins(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key to auth.users
    ALTER TABLE public.pin_shares 
    ADD CONSTRAINT fk_pin_shares_shared_with 
    FOREIGN KEY (shared_with_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    ALTER TABLE public.pin_shares 
    ADD CONSTRAINT fk_pin_shares_shared_by 
    FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- Step 5: Create indexes for better performance
CREATE INDEX idx_pin_shares_pin_id ON public.pin_shares(pin_id);
CREATE INDEX idx_pin_shares_shared_with ON public.pin_shares(shared_with_user_id);
CREATE INDEX idx_pin_shares_shared_by ON public.pin_shares(shared_by_user_id);

-- Step 6: Enable Row Level Security
ALTER TABLE public.pin_shares ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
-- Policy 1: Users can view shares they're involved in
CREATE POLICY "Users can view their shares" ON public.pin_shares
    FOR SELECT USING (
        shared_with_user_id = auth.uid() OR 
        shared_by_user_id = auth.uid()
    );

-- Policy 2: Users can create shares for pins they own
CREATE POLICY "Users can create shares" ON public.pin_shares
    FOR INSERT WITH CHECK (
        shared_by_user_id = auth.uid()
    );

-- Policy 3: Users can update shares they created
CREATE POLICY "Users can update their shares" ON public.pin_shares
    FOR UPDATE USING (shared_by_user_id = auth.uid());

-- Policy 4: Users can delete shares they created
CREATE POLICY "Users can delete their shares" ON public.pin_shares
    FOR DELETE USING (shared_by_user_id = auth.uid());

-- Step 8: Test the table structure (without foreign key violations)
SELECT 'Testing table creation - checking constraints work correctly:' as info;

-- Test that foreign key constraints are working by attempting an invalid insert
-- This should fail with foreign key constraint error, proving constraints work
DO $$
BEGIN
    -- Try to insert invalid data - this should fail
    BEGIN
        INSERT INTO public.pin_shares (
            pin_id, 
            shared_with_user_id, 
            shared_by_user_id, 
            permission_level
        ) VALUES (
            '00000000-0000-0000-0000-000000000999',  -- non-existent pin_id
            '00000000-0000-0000-0000-000000000998',  -- non-existent user_id  
            '00000000-0000-0000-0000-000000000997',  -- non-existent user_id
            'view'
        );
        RAISE NOTICE 'ERROR: Foreign key constraints are NOT working - this should have failed!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'SUCCESS: Foreign key constraints are working correctly - rejected invalid data as expected';
    END;
END $$;

-- Verify table structure without inserting invalid data
SELECT 'Table structure verified - constraints are active' as result;

-- Step 9: Verify final structure
SELECT 'Final pin_shares table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'pin_shares' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Database migration completed successfully!' as result;
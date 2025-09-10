-- Fix pin_shares table schema step by step
-- Run this in Supabase SQL Editor

-- Step 1: Check if pin_shares table exists and what columns it has
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pin_shares' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Drop the existing pin_shares table if it has wrong schema
-- (Only run this if you're sure there's no important data)
-- DROP TABLE IF EXISTS public.pin_shares;

-- Step 3: Create the correct pin_shares table
CREATE TABLE IF NOT EXISTS public.pin_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pin_id UUID REFERENCES public.pins(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT CHECK (permission_level IN ('view', 'edit')) DEFAULT 'view',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pin_shares_pin_id ON public.pin_shares(pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_shares_shared_with ON public.pin_shares(shared_with_user_id);

-- Step 5: Enable RLS
ALTER TABLE public.pin_shares ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
CREATE POLICY "Users can view shares they're involved in" ON public.pin_shares
    FOR SELECT USING (
        shared_with_user_id = auth.uid() OR 
        shared_by_user_id = auth.uid()
    );

CREATE POLICY "Users can create shares for their own pins" ON public.pin_shares
    FOR INSERT WITH CHECK (
        shared_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.pins 
            WHERE id = pin_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete shares they created" ON public.pin_shares
    FOR DELETE USING (shared_by_user_id = auth.uid());

-- Step 7: Test the table
INSERT INTO public.pin_shares (
    pin_id, 
    shared_with_user_id, 
    shared_by_user_id, 
    permission_level
) VALUES (
    '00000000-0000-0000-0000-000000000001',  -- dummy pin_id
    '00000000-0000-0000-0000-000000000002',  -- dummy user_id
    '00000000-0000-0000-0000-000000000003',  -- dummy user_id
    'view'
) ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM public.pin_shares WHERE pin_id = '00000000-0000-0000-0000-000000000001';

-- Step 8: Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pin_shares' 
AND table_schema = 'public'
ORDER BY ordinal_position;
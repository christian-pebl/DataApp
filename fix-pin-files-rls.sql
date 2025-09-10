-- Fix RLS policies for pin_files table to properly check user ownership through pin ownership
-- Run this in your Supabase SQL Editor

-- First, drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view their own pin files" ON public.pin_files;
DROP POLICY IF EXISTS "Users can insert their own pin files" ON public.pin_files;
DROP POLICY IF EXISTS "Users can update their own pin files" ON public.pin_files;
DROP POLICY IF EXISTS "Users can delete their own pin files" ON public.pin_files;

-- Create new policies that properly check user ownership through the pins table
-- Users can only view files for pins they own
CREATE POLICY "Users can view files for their own pins" ON public.pin_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- Users can only insert files for pins they own
CREATE POLICY "Users can insert files for their own pins" ON public.pin_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- Users can only update files for pins they own
CREATE POLICY "Users can update files for their own pins" ON public.pin_files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- Users can only delete files for pins they own
CREATE POLICY "Users can delete files for their own pins" ON public.pin_files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.pins 
            WHERE pins.id = pin_files.pin_id 
            AND pins.user_id::text = auth.uid()::text
        )
    );

-- Also fix the storage policies to be more restrictive
DROP POLICY IF EXISTS "Users can view pin files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload pin files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update pin files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete pin files" ON storage.objects;

-- Create more restrictive storage policies
-- For storage, we'll still allow authenticated users but the app logic will enforce ownership
CREATE POLICY "Authenticated users can view pin files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'pin-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can upload pin files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'pin-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update their pin files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'pin-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete their pin files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'pin-files' 
        AND auth.role() = 'authenticated'
    );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'pin_files'
ORDER BY policyname;
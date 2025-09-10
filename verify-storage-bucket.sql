-- Verify Storage Bucket Configuration for Pin Files
-- Run this in your Supabase SQL Editor to check the storage setup

-- 1. Check if the pin-files bucket exists
SELECT 
    id,
    name,
    public,
    created_at,
    updated_at
FROM storage.buckets
WHERE id = 'pin-files';

-- 2. Check storage policies for the pin-files bucket
SELECT 
    name,
    definition,
    action,
    check_expression
FROM storage.policies
WHERE bucket_id = 'pin-files';

-- 3. Check if there are any files in the bucket
SELECT 
    COUNT(*) as total_files,
    SUM(metadata->>'size')::bigint as total_size_bytes
FROM storage.objects
WHERE bucket_id = 'pin-files';

-- 4. Check the pin_files table for any records
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT pin_id) as unique_pins,
    COUNT(DISTINCT LEFT(file_path, 50)) as unique_paths
FROM public.pin_files;

-- 5. Sample of recent pin_files records (if any)
SELECT 
    id,
    pin_id,
    file_name,
    file_path,
    file_size,
    uploaded_at
FROM public.pin_files
ORDER BY uploaded_at DESC
LIMIT 5;

-- 6. Check RLS policies on pin_files table
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'pin_files'
ORDER BY policyname;

-- 7. If the bucket doesn't exist, create it:
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('pin-files', 'pin-files', false)
-- ON CONFLICT (id) DO NOTHING;
-- Check for files with string 'null' as pin_id
SELECT id, file_name, pin_id, created_at
FROM pin_files
WHERE pin_id::text = 'null'
ORDER BY created_at DESC;

-- Fix: Set these to actual NULL (uncomment to apply)
-- UPDATE pin_files
-- SET pin_id = NULL
-- WHERE pin_id::text = 'null';

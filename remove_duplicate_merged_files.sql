-- Script to remove duplicate merged files
-- This keeps the oldest file and removes newer duplicates with the same name and pin_id

-- Step 1: View duplicates (run this first to see what will be deleted)
SELECT
  pin_id,
  file_name,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at) as file_ids,
  ARRAY_AGG(created_at ORDER BY created_at) as created_dates
FROM pin_files
GROUP BY pin_id, file_name
HAVING COUNT(*) > 1
ORDER BY file_name;

-- Step 2: Delete duplicate files (keeps the oldest, removes newer ones)
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE DUPLICATES
/*
WITH duplicates AS (
  SELECT
    id,
    pin_id,
    file_name,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY pin_id, file_name
      ORDER BY created_at ASC  -- Keep the oldest file
    ) as row_num
  FROM pin_files
)
DELETE FROM pin_files
WHERE id IN (
  SELECT id
  FROM duplicates
  WHERE row_num > 1  -- Delete all but the first (oldest) duplicate
);
*/

-- Step 3: Check if duplicates are gone
-- Run this after the delete to verify
SELECT
  pin_id,
  file_name,
  COUNT(*) as count
FROM pin_files
GROUP BY pin_id, file_name
HAVING COUNT(*) > 1;

-- Alternative: If you want to keep the NEWEST file instead of the oldest,
-- change "ORDER BY created_at ASC" to "ORDER BY created_at DESC" in Step 2

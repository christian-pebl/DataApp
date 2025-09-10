-- SAFE PROJECT_ID MIGRATION SCRIPT
-- This script safely changes project_id columns from UUID to TEXT
-- while preserving all existing data

-- Step 1: Check current state of project_id columns
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'project_id' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Step 2: Backup existing data (just to see what we have)
SELECT COUNT(*) as pin_count, 
       COUNT(project_id) as pins_with_projects 
FROM pins;

SELECT COUNT(*) as line_count, 
       COUNT(project_id) as lines_with_projects 
FROM lines;

SELECT COUNT(*) as area_count, 
       COUNT(project_id) as areas_with_projects 
FROM areas;

SELECT COUNT(*) as tag_count, 
       COUNT(project_id) as tags_with_projects 
FROM tags;

-- Step 3: Check if any existing project_ids have values
-- This will show us what's currently stored
SELECT DISTINCT project_id 
FROM pins 
WHERE project_id IS NOT NULL
LIMIT 10;

SELECT DISTINCT project_id 
FROM lines 
WHERE project_id IS NOT NULL
LIMIT 10;

SELECT DISTINCT project_id 
FROM areas 
WHERE project_id IS NOT NULL
LIMIT 10;

-- Step 4: Create backup of current project_id values (if any exist)
-- This creates temporary columns to store existing UUIDs if needed
ALTER TABLE pins ADD COLUMN IF NOT EXISTS project_id_backup UUID;
ALTER TABLE lines ADD COLUMN IF NOT EXISTS project_id_backup UUID;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS project_id_backup UUID;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS project_id_backup UUID;

-- Copy existing values to backup
UPDATE pins SET project_id_backup = project_id WHERE project_id IS NOT NULL;
UPDATE lines SET project_id_backup = project_id WHERE project_id IS NOT NULL;
UPDATE areas SET project_id_backup = project_id WHERE project_id IS NOT NULL;
UPDATE tags SET project_id_backup = project_id WHERE project_id IS NOT NULL;

-- Step 5: Safely alter column types
-- The USING clause ensures any existing UUID values are converted to text
ALTER TABLE pins 
  ALTER COLUMN project_id TYPE TEXT 
  USING CASE 
    WHEN project_id IS NULL THEN NULL 
    ELSE project_id::TEXT 
  END;

ALTER TABLE lines 
  ALTER COLUMN project_id TYPE TEXT 
  USING CASE 
    WHEN project_id IS NULL THEN NULL 
    ELSE project_id::TEXT 
  END;

ALTER TABLE areas 
  ALTER COLUMN project_id TYPE TEXT 
  USING CASE 
    WHEN project_id IS NULL THEN NULL 
    ELSE project_id::TEXT 
  END;

ALTER TABLE tags 
  ALTER COLUMN project_id TYPE TEXT 
  USING CASE 
    WHEN project_id IS NULL THEN NULL 
    ELSE project_id::TEXT 
  END;

-- Step 6: Verify the migration worked
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'project_id' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Step 7: Check data integrity after migration
SELECT 
  'pins' as table_name,
  COUNT(*) as total_rows,
  COUNT(project_id) as rows_with_project,
  COUNT(project_id_backup) as backed_up_values
FROM pins
UNION ALL
SELECT 
  'lines' as table_name,
  COUNT(*) as total_rows,
  COUNT(project_id) as rows_with_project,
  COUNT(project_id_backup) as backed_up_values
FROM lines
UNION ALL
SELECT 
  'areas' as table_name,
  COUNT(*) as total_rows,
  COUNT(project_id) as rows_with_project,
  COUNT(project_id_backup) as backed_up_values
FROM areas
UNION ALL
SELECT 
  'tags' as table_name,
  COUNT(*) as total_rows,
  COUNT(project_id) as rows_with_project,
  COUNT(project_id_backup) as backed_up_values
FROM tags;

-- Step 8: Test that we can now insert string project IDs
-- This is just a test, we'll rollback
BEGIN;
INSERT INTO pins (label, lat, lng, project_id, label_visible, user_id)
VALUES ('Migration Test', 51.5, -0.1, 'milfordhaven', true, (SELECT id FROM auth.users LIMIT 1))
RETURNING id, project_id;
ROLLBACK;

-- Step 9: If everything looks good, you can drop the backup columns
-- ONLY RUN THIS AFTER CONFIRMING EVERYTHING WORKS!
-- ALTER TABLE pins DROP COLUMN IF EXISTS project_id_backup;
-- ALTER TABLE lines DROP COLUMN IF EXISTS project_id_backup;
-- ALTER TABLE areas DROP COLUMN IF EXISTS project_id_backup;
-- ALTER TABLE tags DROP COLUMN IF EXISTS project_id_backup;

-- SUCCESS MESSAGE
-- If you see this, the migration completed successfully
SELECT 'Migration completed successfully! project_id columns are now TEXT type.' as status;
-- Migration: Add support for uploading files to areas (in addition to pins)
-- This allows users to attach datasets to drawn polygons/regions

-- Step 1: Add area_id column to pin_files table
ALTER TABLE public.pin_files
  ADD COLUMN area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE;

-- Step 2: Make pin_id optional (remove NOT NULL constraint)
-- Files can now be attached to either a pin OR an area
ALTER TABLE public.pin_files
  ALTER COLUMN pin_id DROP NOT NULL;

-- Step 3: Add constraint to ensure files are attached to exactly one target
-- Must have either pin_id OR area_id (not both, not neither)
ALTER TABLE public.pin_files
  ADD CONSTRAINT pin_files_target_check
  CHECK (
    (pin_id IS NOT NULL AND area_id IS NULL) OR
    (pin_id IS NULL AND area_id IS NOT NULL)
  );

-- Step 4: Add index for area file queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_pin_files_area_id ON public.pin_files(area_id);

-- Step 5: Add documentation comment
COMMENT ON COLUMN public.pin_files.area_id IS 'Optional reference to area polygon - mutually exclusive with pin_id. Used for regional/multi-site datasets.';

-- Verification query (optional - uncomment to test after migration)
-- SELECT
--   id,
--   file_name,
--   pin_id,
--   area_id,
--   CASE
--     WHEN pin_id IS NOT NULL THEN 'Attached to Pin'
--     WHEN area_id IS NOT NULL THEN 'Attached to Area'
--     ELSE 'ERROR: Not attached'
--   END as attachment_status
-- FROM public.pin_files
-- LIMIT 10;

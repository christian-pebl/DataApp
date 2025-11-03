-- Migration: Fix RLS policies for pin_files to support area ownership
-- The existing policies only check pin ownership, need to also check area ownership

-- Step 1: Drop existing RLS policies for pin_files
DROP POLICY IF EXISTS "Users can insert files for their own pins" ON public.pin_files;
DROP POLICY IF EXISTS "Users can view files for their own pins" ON public.pin_files;
DROP POLICY IF EXISTS "Users can update files for their own pins" ON public.pin_files;
DROP POLICY IF EXISTS "Users can delete files for their own pins" ON public.pin_files;

-- Step 2: Create new INSERT policy that checks both pin and area ownership
CREATE POLICY "Users can insert files for their own pins or areas"
ON public.pin_files FOR INSERT
WITH CHECK (
  (pin_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()
  ))
  OR
  (area_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.areas
    WHERE areas.id = pin_files.area_id
    AND areas.user_id = auth.uid()
  ))
);

-- Step 3: Create new SELECT policy that checks both pin and area ownership
CREATE POLICY "Users can view files for their own pins or areas"
ON public.pin_files FOR SELECT
USING (
  (pin_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()
  ))
  OR
  (area_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.areas
    WHERE areas.id = pin_files.area_id
    AND areas.user_id = auth.uid()
  ))
);

-- Step 4: Create new UPDATE policy that checks both pin and area ownership
CREATE POLICY "Users can update files for their own pins or areas"
ON public.pin_files FOR UPDATE
USING (
  (pin_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()
  ))
  OR
  (area_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.areas
    WHERE areas.id = pin_files.area_id
    AND areas.user_id = auth.uid()
  ))
);

-- Step 5: Create new DELETE policy that checks both pin and area ownership
CREATE POLICY "Users can delete files for their own pins or areas"
ON public.pin_files FOR DELETE
USING (
  (pin_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pins
    WHERE pins.id = pin_files.pin_id
    AND pins.user_id = auth.uid()
  ))
  OR
  (area_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.areas
    WHERE areas.id = pin_files.area_id
    AND areas.user_id = auth.uid()
  ))
);

-- Verification query (optional - uncomment to test after migration)
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'pin_files'
-- ORDER BY policyname;

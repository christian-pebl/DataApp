-- Add visual_properties column to pin_files table
-- This stores style rules and visual configurations as JSON
-- Includes axis widths, titles, ranges, and other display properties

ALTER TABLE public.pin_files
ADD COLUMN IF NOT EXISTS visual_properties JSONB DEFAULT '{}'::jsonb;

-- Create index for querying visual properties
CREATE INDEX IF NOT EXISTS idx_pin_files_visual_properties ON public.pin_files USING gin(visual_properties);

-- Add comment to explain the column
COMMENT ON COLUMN public.pin_files.visual_properties IS 'JSON object storing visual configuration like axis widths, titles, and display properties';

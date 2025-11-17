-- Check if start_date and end_date columns exist in pin_files table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pin_files'
  AND column_name IN ('start_date', 'end_date');

-- If the query above returns 0 rows, run the following to add the columns:
/*
ALTER TABLE public.pin_files
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_pin_files_start_date ON public.pin_files(start_date);
CREATE INDEX IF NOT EXISTS idx_pin_files_end_date ON public.pin_files(end_date);
*/

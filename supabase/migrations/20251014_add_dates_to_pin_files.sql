-- Add start_date and end_date columns to pin_files table
-- This allows storing file date ranges directly in the database
-- instead of parsing them on every request

ALTER TABLE public.pin_files
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_pin_files_start_date ON public.pin_files(start_date);
CREATE INDEX IF NOT EXISTS idx_pin_files_end_date ON public.pin_files(end_date);

-- Add comment to explain the columns
COMMENT ON COLUMN public.pin_files.start_date IS 'First date found in the data file';
COMMENT ON COLUMN public.pin_files.end_date IS 'Last date found in the data file';

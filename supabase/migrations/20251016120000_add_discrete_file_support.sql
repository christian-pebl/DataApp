-- Add support for discrete sampling files (CROP, CHEM, WQ)
-- These files have individual sampling days rather than continuous time ranges

ALTER TABLE public.pin_files
ADD COLUMN IF NOT EXISTS is_discrete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unique_dates JSONB DEFAULT NULL;

-- Create index for discrete file queries
CREATE INDEX IF NOT EXISTS idx_pin_files_is_discrete ON public.pin_files(is_discrete);

-- Add comments to explain the columns
COMMENT ON COLUMN public.pin_files.is_discrete IS 'True for discrete sampling files (CROP, CHEM, WQ) that have individual sampling days';
COMMENT ON COLUMN public.pin_files.unique_dates IS 'Array of unique sampling dates for discrete files (format: ["DD/MM/YYYY", ...])';

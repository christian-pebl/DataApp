-- Create merged_files table for storing merged file metadata
CREATE TABLE IF NOT EXISTS public.merged_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id UUID NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'text/csv',

    -- Merge configuration
    merge_mode TEXT NOT NULL CHECK (merge_mode IN ('sequential', 'stack-parameters')),
    merge_rules JSONB DEFAULT '[]'::jsonb,

    -- Source file tracking
    source_file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_files_metadata JSONB DEFAULT '{}'::jsonb,
    missing_source_files JSONB DEFAULT '[]'::jsonb,

    -- Date range from merged data
    start_date DATE,
    end_date DATE,

    -- Project association
    project_id TEXT NOT NULL DEFAULT 'default',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_merged_files_pin_id ON public.merged_files(pin_id);
CREATE INDEX IF NOT EXISTS idx_merged_files_project_id ON public.merged_files(project_id);
CREATE INDEX IF NOT EXISTS idx_merged_files_created_at ON public.merged_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merged_files_start_date ON public.merged_files(start_date);
CREATE INDEX IF NOT EXISTS idx_merged_files_end_date ON public.merged_files(end_date);

-- Create GIN index for JSONB columns for faster queries
CREATE INDEX IF NOT EXISTS idx_merged_files_source_file_ids ON public.merged_files USING GIN (source_file_ids);
CREATE INDEX IF NOT EXISTS idx_merged_files_missing_source_files ON public.merged_files USING GIN (missing_source_files);

-- Set up Row Level Security (RLS)
ALTER TABLE public.merged_files ENABLE ROW LEVEL SECURITY;

-- Create policies for merged_files table
CREATE POLICY "Users can view merged files for their pins" ON public.merged_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pins
            WHERE pins.id = merged_files.pin_id
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert merged files for their pins" ON public.merged_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pins
            WHERE pins.id = merged_files.pin_id
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own merged files" ON public.merged_files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pins
            WHERE pins.id = merged_files.pin_id
            AND pins.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own merged files" ON public.merged_files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.pins
            WHERE pins.id = merged_files.pin_id
            AND pins.user_id = auth.uid()
        )
    );

-- Create updated_at trigger for merged_files
CREATE TRIGGER update_merged_files_updated_at
    BEFORE UPDATE ON public.merged_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to explain the table structure
COMMENT ON TABLE public.merged_files IS 'Stores metadata for merged CSV files created from multiple uploaded files';
COMMENT ON COLUMN public.merged_files.merge_mode IS 'Type of merge performed: sequential (rows) or stack-parameters (columns)';
COMMENT ON COLUMN public.merged_files.merge_rules IS 'JSON array of merge rules applied during merge';
COMMENT ON COLUMN public.merged_files.source_file_ids IS 'JSON array of UUIDs referencing pin_files that were merged';
COMMENT ON COLUMN public.merged_files.source_files_metadata IS 'Snapshot of source file metadata at time of merge';
COMMENT ON COLUMN public.merged_files.missing_source_files IS 'JSON array of source file IDs that have been deleted';

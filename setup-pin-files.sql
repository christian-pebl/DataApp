-- Run this SQL in your Supabase SQL Editor to set up file upload functionality

-- Create pin_files table for storing file metadata
CREATE TABLE IF NOT EXISTS public.pin_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id TEXT NOT NULL, -- Changed from UUID to TEXT to match pins table
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'text/csv',
    project_id TEXT NOT NULL DEFAULT 'default',
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pin_files_pin_id ON public.pin_files(pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_files_project_id ON public.pin_files(project_id);
CREATE INDEX IF NOT EXISTS idx_pin_files_uploaded_at ON public.pin_files(uploaded_at DESC);

-- Create storage bucket for pin files if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pin-files', 'pin-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS)
ALTER TABLE public.pin_files ENABLE ROW LEVEL SECURITY;

-- Create policies for pin_files table (allowing all operations for now)
CREATE POLICY "Allow all operations on pin files" ON public.pin_files
    FOR ALL USING (true);

-- Storage policies for pin-files bucket (allowing all operations for now)
CREATE POLICY "Allow all operations on pin files storage" ON storage.objects
    FOR ALL USING (bucket_id = 'pin-files');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pin_files_updated_at
    BEFORE UPDATE ON public.pin_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Test that everything is working
SELECT 'Pin files table and storage bucket setup complete!' as status;
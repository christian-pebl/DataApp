-- Create pin_files table for storing file metadata
CREATE TABLE IF NOT EXISTS public.pin_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id UUID NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
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

-- Create policies for pin_files table
CREATE POLICY "Users can view their own pin files" ON public.pin_files
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own pin files" ON public.pin_files
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own pin files" ON public.pin_files
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own pin files" ON public.pin_files
    FOR DELETE USING (true);

-- Storage policies for pin-files bucket
CREATE POLICY "Users can view pin files" ON storage.objects
    FOR SELECT USING (bucket_id = 'pin-files');

CREATE POLICY "Users can upload pin files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'pin-files');

CREATE POLICY "Users can update pin files" ON storage.objects
    FOR UPDATE USING (bucket_id = 'pin-files');

CREATE POLICY "Users can delete pin files" ON storage.objects
    FOR DELETE USING (bucket_id = 'pin-files');

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
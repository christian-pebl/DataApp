-- Create saved_plot_views table for storing saved plot view configurations
CREATE TABLE IF NOT EXISTS public.saved_plot_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    pin_id UUID REFERENCES public.pins(id) ON DELETE CASCADE,

    -- View identification
    name TEXT NOT NULL,
    description TEXT,

    -- View configuration (JSONB for flexibility)
    view_config JSONB NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique names per user per project
    CONSTRAINT unique_user_project_name UNIQUE(user_id, project_id, name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_plot_views_user_id ON public.saved_plot_views(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_plot_views_project_id ON public.saved_plot_views(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_plot_views_created_at ON public.saved_plot_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_plot_views_pin_id ON public.saved_plot_views(pin_id);

-- Create GIN index for JSONB column for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_plot_views_config ON public.saved_plot_views USING GIN (view_config);

-- Set up Row Level Security (RLS)
ALTER TABLE public.saved_plot_views ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_plot_views table
CREATE POLICY "Users can view their own saved plot views" ON public.saved_plot_views
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own saved plot views" ON public.saved_plot_views
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own saved plot views" ON public.saved_plot_views
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved plot views" ON public.saved_plot_views
    FOR DELETE USING (user_id = auth.uid());

-- Create updated_at trigger for saved_plot_views
CREATE TRIGGER update_saved_plot_views_updated_at
    BEFORE UPDATE ON public.saved_plot_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to explain the table structure
COMMENT ON TABLE public.saved_plot_views IS 'Stores saved plot view configurations for stacked plots, allowing users to save and restore complete plot states';
COMMENT ON COLUMN public.saved_plot_views.view_config IS 'JSONB containing complete plot configuration including plots, time axis mode, brush range, visibility state, etc.';
COMMENT ON COLUMN public.saved_plot_views.name IS 'User-defined name for the saved view (must be unique per user per project)';
COMMENT ON COLUMN public.saved_plot_views.description IS 'Optional description of what this view shows';
COMMENT ON COLUMN public.saved_plot_views.project_id IS 'Project this view belongs to (for filtering views by project)';
COMMENT ON COLUMN public.saved_plot_views.pin_id IS 'Optional reference to a specific pin if view is pin-specific';

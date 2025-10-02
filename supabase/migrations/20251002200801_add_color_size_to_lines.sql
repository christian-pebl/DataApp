-- Add color and size columns to lines table
ALTER TABLE lines
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 3;

-- Add comment for documentation
COMMENT ON COLUMN lines.color IS 'Hex color code for line rendering';
COMMENT ON COLUMN lines.size IS 'Line thickness in pixels';

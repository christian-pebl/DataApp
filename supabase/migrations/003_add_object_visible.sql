-- Add object_visible column to pins, lines, and areas tables
-- This controls whether the entire object is visible on the map (not just the label)

-- Add to pins table
ALTER TABLE pins
ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;

-- Add to lines table
ALTER TABLE lines
ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;

-- Add to areas table
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;

-- Add indexes for better performance when filtering by visibility
CREATE INDEX IF NOT EXISTS pins_object_visible_idx ON pins(object_visible);
CREATE INDEX IF NOT EXISTS lines_object_visible_idx ON lines(object_visible);
CREATE INDEX IF NOT EXISTS areas_object_visible_idx ON areas(object_visible);

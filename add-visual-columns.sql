-- Run this SQL in your Supabase SQL editor to add the missing columns
-- This adds visual properties columns to existing tables

-- Add visual properties to lines table
ALTER TABLE lines
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 3;

-- Add visual properties to areas table
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS transparency INTEGER DEFAULT 20;

-- Add visual properties to pins table (for consistency)
ALTER TABLE pins
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 6;

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    column_default
FROM
    information_schema.columns
WHERE
    table_name IN ('pins', 'lines', 'areas')
    AND column_name IN ('color', 'size', 'transparency')
ORDER BY
    table_name, column_name;
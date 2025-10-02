-- This script adds the missing color column to the areas table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Check if the color column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'areas'
        AND column_name = 'color'
    ) THEN
        ALTER TABLE areas ADD COLUMN color TEXT DEFAULT '#8b5cf6';
        RAISE NOTICE 'Added color column to areas table';
    ELSE
        RAISE NOTICE 'Color column already exists';
    END IF;
END $$;

-- Check if the size column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'areas'
        AND column_name = 'size'
    ) THEN
        ALTER TABLE areas ADD COLUMN size INTEGER DEFAULT 2;
        RAISE NOTICE 'Added size column to areas table';
    ELSE
        RAISE NOTICE 'Size column already exists';
    END IF;
END $$;

-- Check if the transparency column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'areas'
        AND column_name = 'transparency'
    ) THEN
        ALTER TABLE areas ADD COLUMN transparency INTEGER DEFAULT 20;
        RAISE NOTICE 'Added transparency column to areas table';
    ELSE
        RAISE NOTICE 'Transparency column already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'areas'
AND column_name IN ('color', 'size', 'transparency');

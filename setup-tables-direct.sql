-- Create missing tables for PEBL Ocean Data Platform
-- Run this SQL directly in the Supabase SQL Editor or via psql

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lines table
CREATE TABLE IF NOT EXISTS lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path JSONB NOT NULL,
  label TEXT NOT NULL,
  notes TEXT,
  label_visible BOOLEAN DEFAULT true,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create areas table
CREATE TABLE IF NOT EXISTS areas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path JSONB NOT NULL,
  label TEXT NOT NULL,
  notes TEXT,
  label_visible BOOLEAN DEFAULT true,
  fill_visible BOOLEAN DEFAULT true,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create junction table for pin-tag relationships
CREATE TABLE IF NOT EXISTS pin_tags (
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pin_id, tag_id)
);

-- Create junction table for line-tag relationships
CREATE TABLE IF NOT EXISTS line_tags (
  line_id UUID REFERENCES lines(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (line_id, tag_id)
);

-- Create junction table for area-tag relationships
CREATE TABLE IF NOT EXISTS area_tags (
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (area_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS lines_user_id_idx ON lines(user_id);
CREATE INDEX IF NOT EXISTS lines_project_id_idx ON lines(project_id);
CREATE INDEX IF NOT EXISTS areas_user_id_idx ON areas(user_id);
CREATE INDEX IF NOT EXISTS areas_project_id_idx ON areas(project_id);
CREATE INDEX IF NOT EXISTS tags_user_id_idx ON tags(user_id);
CREATE INDEX IF NOT EXISTS tags_project_id_idx ON tags(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only access their own data
CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for lines
CREATE POLICY "Users can view their own lines" ON lines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lines" ON lines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lines" ON lines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lines" ON lines
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for areas
CREATE POLICY "Users can view their own areas" ON areas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own areas" ON areas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own areas" ON areas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own areas" ON areas
  FOR DELETE USING (auth.uid() = user_id);

-- Junction table policies (users can access junction records for their own pins/lines/areas)
CREATE POLICY "Users can view their pin tags" ON pin_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their pin tags" ON pin_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their pin tags" ON pin_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()
    )
  );

-- Similar policies for line_tags
CREATE POLICY "Users can view their line tags" ON line_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their line tags" ON line_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their line tags" ON line_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()
    )
  );

-- Similar policies for area_tags
CREATE POLICY "Users can view their area tags" ON area_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their area tags" ON area_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their area tags" ON area_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()
    )
  );

-- Clean up test data if needed
-- DELETE FROM pins WHERE label = 'Test Pin';
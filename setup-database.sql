-- Create database schema for map drawing application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  description TEXT,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  color VARCHAR NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pins table
CREATE TABLE IF NOT EXISTS pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label VARCHAR NOT NULL,
  notes TEXT,
  label_visible BOOLEAN DEFAULT TRUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lines table
CREATE TABLE IF NOT EXISTS lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path JSONB NOT NULL,
  label VARCHAR NOT NULL,
  notes TEXT,
  label_visible BOOLEAN DEFAULT TRUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Areas table
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path JSONB NOT NULL,
  label VARCHAR NOT NULL,
  notes TEXT,
  label_visible BOOLEAN DEFAULT TRUE,
  fill_visible BOOLEAN DEFAULT TRUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction tables for tags
CREATE TABLE IF NOT EXISTS pin_tags (
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pin_id, tag_id)
);

CREATE TABLE IF NOT EXISTS line_tags (
  line_id UUID REFERENCES lines(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (line_id, tag_id)
);

CREATE TABLE IF NOT EXISTS area_tags (
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (area_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_project_id ON tags(project_id);
CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_project_id ON pins(project_id);
CREATE INDEX IF NOT EXISTS idx_lines_user_id ON lines(user_id);
CREATE INDEX IF NOT EXISTS idx_lines_project_id ON lines(project_id);
CREATE INDEX IF NOT EXISTS idx_areas_user_id ON areas(user_id);
CREATE INDEX IF NOT EXISTS idx_areas_project_id ON areas(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user data isolation
CREATE POLICY "Users can only see their own projects" ON projects FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Users can only see their own tags" ON tags FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Users can only see their own pins" ON pins FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Users can only see their own lines" ON lines FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Users can only see their own areas" ON areas FOR ALL USING (auth.uid()::text = user_id);

-- Junction table policies
CREATE POLICY "Users can manage pin tags for their pins" ON pin_tags FOR ALL 
USING (EXISTS (SELECT 1 FROM pins WHERE pins.id = pin_tags.pin_id AND pins.user_id = auth.uid()::text));

CREATE POLICY "Users can manage line tags for their lines" ON line_tags FOR ALL 
USING (EXISTS (SELECT 1 FROM lines WHERE lines.id = line_tags.line_id AND lines.user_id = auth.uid()::text));

CREATE POLICY "Users can manage area tags for their areas" ON area_tags FOR ALL 
USING (EXISTS (SELECT 1 FROM areas WHERE areas.id = area_tags.area_id AND areas.user_id = auth.uid()::text));
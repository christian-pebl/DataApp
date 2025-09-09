-- Create enum for sharing permission levels
CREATE TYPE share_permission AS ENUM ('view', 'edit', 'admin');

-- Create pin_shares table for user-to-user sharing
CREATE TABLE IF NOT EXISTS pin_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for public shares
  permission share_permission NOT NULL DEFAULT 'view',
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique sharing per user per pin
  UNIQUE(pin_id, shared_with_id)
);

-- Create share_tokens table for public/link sharing
CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- For sharing entire projects
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission share_permission NOT NULL DEFAULT 'view',
  password_hash TEXT, -- Optional password protection
  max_uses INTEGER, -- Limit number of uses
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ, -- Token expiration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Check constraint for either pin or project, not both
  CONSTRAINT share_token_target CHECK (
    (pin_id IS NOT NULL AND project_id IS NULL) OR 
    (pin_id IS NULL AND project_id IS NOT NULL)
  )
);

-- Create share_analytics table to track share usage
CREATE TABLE IF NOT EXISTS share_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token_id UUID REFERENCES share_tokens(id) ON DELETE CASCADE,
  pin_share_id UUID REFERENCES pin_shares(id) ON DELETE CASCADE,
  accessed_by_ip INET,
  accessed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50), -- 'view', 'download', 'edit', etc.
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either token or direct share, not both
  CONSTRAINT analytics_source CHECK (
    (share_token_id IS NOT NULL AND pin_share_id IS NULL) OR 
    (share_token_id IS NULL AND pin_share_id IS NOT NULL)
  )
);

-- Add sharing-related columns to pins table
ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS last_shared_at TIMESTAMPTZ;

-- Add sharing-related columns to projects table  
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_shared_at TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS pin_shares_pin_id_idx ON pin_shares(pin_id);
CREATE INDEX IF NOT EXISTS pin_shares_shared_with_id_idx ON pin_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS pin_shares_owner_id_idx ON pin_shares(owner_id);
CREATE INDEX IF NOT EXISTS share_tokens_token_idx ON share_tokens(token);
CREATE INDEX IF NOT EXISTS share_tokens_pin_id_idx ON share_tokens(pin_id);
CREATE INDEX IF NOT EXISTS share_tokens_project_id_idx ON share_tokens(project_id);
CREATE INDEX IF NOT EXISTS share_analytics_token_id_idx ON share_analytics(share_token_id);
CREATE INDEX IF NOT EXISTS share_analytics_share_id_idx ON share_analytics(pin_share_id);

-- Enable RLS on new tables
ALTER TABLE pin_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pin_shares table
-- Owners can manage their shares
CREATE POLICY "Owners can view their pin shares" ON pin_shares
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create pin shares" ON pin_shares
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM pins 
      WHERE pins.id = pin_shares.pin_id 
      AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their pin shares" ON pin_shares
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their pin shares" ON pin_shares
  FOR DELETE USING (auth.uid() = owner_id);

-- Recipients can view shares they received
CREATE POLICY "Recipients can view shares they received" ON pin_shares
  FOR SELECT USING (auth.uid() = shared_with_id);

-- RLS Policies for share_tokens table
CREATE POLICY "Owners can manage their share tokens" ON share_tokens
  FOR ALL USING (auth.uid() = owner_id);

-- Public can view active tokens (for validation)
CREATE POLICY "Anyone can validate share tokens" ON share_tokens
  FOR SELECT USING (is_active = true);

-- RLS Policies for share_analytics
CREATE POLICY "Owners can view their share analytics" ON share_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_tokens 
      WHERE share_tokens.id = share_analytics.share_token_id 
      AND share_tokens.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM pin_shares 
      WHERE pin_shares.id = share_analytics.pin_share_id 
      AND pin_shares.owner_id = auth.uid()
    )
  );

-- Update existing RLS policies for pins table to include shared access
DROP POLICY IF EXISTS "Users can view their own pins" ON pins;
CREATE POLICY "Users can view owned and shared pins" ON pins
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pin_shares 
      WHERE pin_shares.pin_id = pins.id 
      AND pin_shares.shared_with_id = auth.uid()
      AND (pin_shares.expires_at IS NULL OR pin_shares.expires_at > NOW())
    )
  );

-- Users with edit permission can update shared pins
DROP POLICY IF EXISTS "Users can update their own pins" ON pins;
CREATE POLICY "Users can update owned pins and shared pins with edit permission" ON pins
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pin_shares 
      WHERE pin_shares.pin_id = pins.id 
      AND pin_shares.shared_with_id = auth.uid()
      AND pin_shares.permission IN ('edit', 'admin')
      AND (pin_shares.expires_at IS NULL OR pin_shares.expires_at > NOW())
    )
  );

-- Only owners and admins can delete pins
DROP POLICY IF EXISTS "Users can delete their own pins" ON pins;
CREATE POLICY "Users can delete owned pins and shared pins with admin permission" ON pins
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pin_shares 
      WHERE pin_shares.pin_id = pins.id 
      AND pin_shares.shared_with_id = auth.uid()
      AND pin_shares.permission = 'admin'
      AND (pin_shares.expires_at IS NULL OR pin_shares.expires_at > NOW())
    )
  );

-- Update pin_files RLS to include shared access
DROP POLICY IF EXISTS "Users can view files for their pins" ON pin_files;
CREATE POLICY "Users can view files for owned and shared pins" ON pin_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pins 
      WHERE pins.id = pin_files.pin_id 
      AND (
        pins.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM pin_shares 
          WHERE pin_shares.pin_id = pins.id 
          AND pin_shares.shared_with_id = auth.uid()
          AND (pin_shares.expires_at IS NULL OR pin_shares.expires_at > NOW())
        )
      )
    )
  );

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(255) AS $$
DECLARE
  new_token VARCHAR(255);
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (URL-safe base64)
    new_token := encode(gen_random_bytes(32), 'base64');
    new_token := replace(new_token, '+', '-');
    new_token := replace(new_token, '/', '_');
    new_token := replace(new_token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM share_tokens WHERE token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Function to update share counts
CREATE OR REPLACE FUNCTION update_share_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update pin share count
    IF NEW.pin_id IS NOT NULL THEN
      UPDATE pins 
      SET 
        is_shared = true,
        share_count = share_count + 1,
        last_shared_at = NOW()
      WHERE id = NEW.pin_id;
    END IF;
    
    -- Update project share count
    IF NEW.project_id IS NOT NULL THEN
      UPDATE projects 
      SET 
        is_shared = true,
        share_count = share_count + 1,
        last_shared_at = NOW()
      WHERE id = NEW.project_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update pin share count
    IF OLD.pin_id IS NOT NULL THEN
      UPDATE pins 
      SET 
        share_count = GREATEST(0, share_count - 1),
        is_shared = (share_count > 1)
      WHERE id = OLD.pin_id;
    END IF;
    
    -- Update project share count
    IF OLD.project_id IS NOT NULL THEN
      UPDATE projects 
      SET 
        share_count = GREATEST(0, share_count - 1),
        is_shared = (share_count > 1)
      WHERE id = OLD.project_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for share count updates
CREATE TRIGGER update_pin_share_counts
  AFTER INSERT OR DELETE ON pin_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_share_counts();

CREATE TRIGGER update_token_share_counts
  AFTER INSERT OR DELETE ON share_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_share_counts();
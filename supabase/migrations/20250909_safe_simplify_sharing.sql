-- Migration: Simplify sharing system
-- Date: 2025-09-09
-- Description: Simplifies permission system to view/edit only, removes expiration, adds invitations

-- 1. Check and update pin_shares table
DO $$ 
BEGIN
  -- Check if permission column exists and update it
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'pin_shares' 
             AND column_name = 'permission') THEN
    -- Update existing permissions: admin -> edit
    UPDATE pin_shares 
    SET permission = 'edit' 
    WHERE permission = 'admin';
    
    -- Add constraint for simplified permissions
    ALTER TABLE pin_shares 
      DROP CONSTRAINT IF EXISTS pin_shares_permission_check;
    
    ALTER TABLE pin_shares 
      ADD CONSTRAINT pin_shares_permission_check 
      CHECK (permission IN ('view', 'edit'));
  END IF;
  
  -- Alternative: if column is named permission_level
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'pin_shares' 
             AND column_name = 'permission_level') THEN
    -- Update existing permissions: admin -> edit
    UPDATE pin_shares 
    SET permission_level = 'edit' 
    WHERE permission_level = 'admin';
    
    -- Add constraint for simplified permissions
    ALTER TABLE pin_shares 
      DROP CONSTRAINT IF EXISTS pin_shares_permission_level_check;
    
    ALTER TABLE pin_shares 
      ADD CONSTRAINT pin_shares_permission_level_check 
      CHECK (permission_level IN ('view', 'edit'));
  END IF;
  
  -- Drop expires_at column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'pin_shares' 
             AND column_name = 'expires_at') THEN
    ALTER TABLE pin_shares DROP COLUMN expires_at;
  END IF;
END $$;

-- 2. Check and update share_tokens table
DO $$ 
BEGIN
  -- Check if permission_level column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'share_tokens' 
             AND column_name = 'permission_level') THEN
    UPDATE share_tokens 
    SET permission_level = 'edit' 
    WHERE permission_level = 'admin';
    
    ALTER TABLE share_tokens 
      DROP CONSTRAINT IF EXISTS share_tokens_permission_level_check;
    
    ALTER TABLE share_tokens 
      ADD CONSTRAINT share_tokens_permission_level_check 
      CHECK (permission_level IN ('view', 'edit'));
  END IF;
  
  -- Alternative: if column is named permission
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'share_tokens' 
             AND column_name = 'permission') THEN
    UPDATE share_tokens 
    SET permission = 'edit' 
    WHERE permission = 'admin';
    
    ALTER TABLE share_tokens 
      DROP CONSTRAINT IF EXISTS share_tokens_permission_check;
    
    ALTER TABLE share_tokens 
      ADD CONSTRAINT share_tokens_permission_check 
      CHECK (permission IN ('view', 'edit'));
  END IF;
END $$;

-- 3. Create invitations table for non-existing users
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invitation_token UUID DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Ensure unique invitation per email per pin
  UNIQUE(pin_id, invitee_email)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- 4. Create or enhance notifications table
DO $$ 
BEGIN
  -- Create notifications table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_name = 'notifications') THEN
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      action_url TEXT,
      notification_type TEXT DEFAULT 'share',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX idx_notifications_created_at ON notifications(created_at);
    
  ELSE
    -- Table exists, add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'is_read') THEN
      ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'action_url') THEN
      ALTER TABLE notifications ADD COLUMN action_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'notification_type') THEN
      ALTER TABLE notifications ADD COLUMN notification_type TEXT DEFAULT 'share';
    END IF;
  END IF;
END $$;

-- Add index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, is_read) 
  WHERE is_read = FALSE;

-- 5. Create function to validate if user exists
CREATE OR REPLACE FUNCTION check_user_exists(email_address TEXT)
RETURNS TABLE (
  user_exists BOOLEAN,
  user_id UUID,
  full_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as user_exists,
    au.id as user_id,
    COALESCE(p.full_name, p.username, SPLIT_PART(email_address, '@', 1)) as full_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.email = email_address
  LIMIT 1;
  
  -- If no user found, return false
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      FALSE as user_exists,
      NULL::UUID as user_id,
      NULL::TEXT as full_name;
  END IF;
END;
$$;

-- 6. Create function to handle invitation acceptance (using dynamic column names)
CREATE OR REPLACE FUNCTION accept_invitation(token UUID, user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  new_share_id UUID;
  current_user_id UUID;
  permission_column_name TEXT;
BEGIN
  -- Get the user ID from email
  SELECT id INTO current_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Find the invitation
  SELECT * INTO invitation_record
  FROM invitations
  WHERE invitation_token = token
    AND status = 'pending'
    AND invitee_email = user_email
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check which column name is used for permissions in pin_shares
  SELECT column_name INTO permission_column_name
  FROM information_schema.columns
  WHERE table_name = 'pin_shares' 
  AND column_name IN ('permission', 'permission_level')
  LIMIT 1;
  
  -- Create the pin share based on column name
  IF permission_column_name = 'permission' THEN
    INSERT INTO pin_shares (
      pin_id,
      shared_with_user_id,
      shared_by_user_id,
      permission,
      created_at
    ) VALUES (
      invitation_record.pin_id,
      current_user_id,
      invitation_record.inviter_id,
      invitation_record.permission_level,
      NOW()
    )
    ON CONFLICT (pin_id, shared_with_user_id) 
    DO UPDATE SET
      permission = EXCLUDED.permission,
      updated_at = NOW()
    RETURNING id INTO new_share_id;
  ELSE
    INSERT INTO pin_shares (
      pin_id,
      shared_with_user_id,
      shared_by_user_id,
      permission_level,
      created_at
    ) VALUES (
      invitation_record.pin_id,
      current_user_id,
      invitation_record.inviter_id,
      invitation_record.permission_level,
      NOW()
    )
    ON CONFLICT (pin_id, shared_with_user_id) 
    DO UPDATE SET
      permission_level = EXCLUDED.permission_level,
      updated_at = NOW()
    RETURNING id INTO new_share_id;
  END IF;
  
  -- Update invitation status
  UPDATE invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = invitation_record.id;
  
  -- Create notification for the inviter
  INSERT INTO notifications (
    user_id,
    title,
    message,
    notification_type,
    action_url,
    metadata,
    created_at
  ) VALUES (
    invitation_record.inviter_id,
    'Invitation Accepted',
    user_email || ' has accepted your invitation to collaborate on a pin',
    'invitation_accepted',
    '/map-drawing',
    jsonb_build_object(
      'pin_id', invitation_record.pin_id,
      'invitee_email', user_email,
      'share_id', new_share_id
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'share_id', new_share_id,
    'pin_id', invitation_record.pin_id
  );
END;
$$;

-- 7. Update RLS policies for invitations table
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pin owners can create invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view their sent invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can lookup invitation by token" ON invitations;
DROP POLICY IF EXISTS "System can update invitations" ON invitations;

-- Create new policies
CREATE POLICY "Pin owners can create invitations"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_id
      AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their sent invitations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

CREATE POLICY "Anyone can lookup invitation by token"
  ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (invitation_token IS NOT NULL);

-- 8. Create function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO count
  FROM notifications
  WHERE user_id = user_uuid
    AND is_read = FALSE;
  
  RETURN COALESCE(count, 0);
END;
$$;

-- 9. Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  notification_ids UUID[],
  user_uuid UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      updated_at = NOW()
  WHERE id = ANY(notification_ids)
    AND user_id = user_uuid
    AND is_read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON invitations TO anon;
GRANT ALL ON invitations TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE invitations IS 'Stores pending invitations for users who do not yet have accounts';
COMMENT ON COLUMN invitations.invitation_token IS 'Unique token used in invitation links';
COMMENT ON FUNCTION check_user_exists IS 'Checks if a user exists by email address';
COMMENT ON FUNCTION accept_invitation IS 'Processes invitation acceptance and creates pin share';
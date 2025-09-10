-- Migration: Simplify sharing system
-- Date: 2025-09-09
-- Description: Simplifies permission system to view/edit only, removes expiration, adds invitations

-- 1. Update pin_shares table - remove admin permission and expiration
ALTER TABLE pin_shares 
  DROP COLUMN IF EXISTS expires_at;

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

-- 2. Update share_tokens table - remove admin permission and simplify
UPDATE share_tokens 
SET permission_level = 'edit' 
WHERE permission_level = 'admin';

ALTER TABLE share_tokens 
  DROP CONSTRAINT IF EXISTS share_tokens_permission_level_check;

ALTER TABLE share_tokens 
  ADD CONSTRAINT share_tokens_permission_level_check 
  CHECK (permission_level IN ('view', 'edit'));

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

-- Create index for faster lookups
CREATE INDEX idx_invitations_token ON invitations(invitation_token);
CREATE INDEX idx_invitations_email ON invitations(invitee_email);
CREATE INDEX idx_invitations_status ON invitations(status);

-- 4. Enhance notifications table for better notification system
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'share';

-- Add index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, is_read) 
  WHERE is_read = FALSE;

-- 5. Create function to validate if user exists
CREATE OR REPLACE FUNCTION check_user_exists(email_address TEXT)
RETURNS TABLE (
  exists BOOLEAN,
  user_id UUID,
  full_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as exists,
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
      FALSE as exists,
      NULL::UUID as user_id,
      NULL::TEXT as full_name;
  END IF;
END;
$$;

-- 6. Create function to handle invitation acceptance
CREATE OR REPLACE FUNCTION accept_invitation(token UUID, user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  new_share_id UUID;
  current_user_id UUID;
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
  
  -- Create the pin share
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

-- Policy for creating invitations (only pin owners)
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

-- Policy for viewing invitations
CREATE POLICY "Users can view their sent invitations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

-- Policy for public invitation lookup (by token)
CREATE POLICY "Anyone can lookup invitation by token"
  ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (invitation_token IS NOT NULL);

-- Policy for updating invitations (only system via functions)
CREATE POLICY "System can update invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 8. Create function to check and create notifications for new shares
CREATE OR REPLACE FUNCTION notify_user_of_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pin_name TEXT;
  sharer_name TEXT;
BEGIN
  -- Get pin details
  SELECT name INTO pin_name
  FROM pins
  WHERE id = NEW.pin_id;
  
  -- Get sharer name
  SELECT COALESCE(p.full_name, p.username, au.email)
  INTO sharer_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.shared_by_user_id;
  
  -- Create notification
  INSERT INTO notifications (
    user_id,
    title,
    message,
    notification_type,
    action_url,
    metadata,
    created_at
  ) VALUES (
    NEW.shared_with_user_id,
    'New Pin Shared',
    sharer_name || ' shared "' || COALESCE(pin_name, 'Unnamed Pin') || '" with you',
    'pin_shared',
    '/map-drawing?pin=' || NEW.pin_id,
    jsonb_build_object(
      'pin_id', NEW.pin_id,
      'pin_name', pin_name,
      'shared_by', NEW.shared_by_user_id,
      'permission_level', NEW.permission_level
    ),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new shares
DROP TRIGGER IF EXISTS notify_on_new_share ON pin_shares;
CREATE TRIGGER notify_on_new_share
  AFTER INSERT ON pin_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_of_share();

-- 9. Add function to get unread notification count
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

-- 10. Function to mark notifications as read
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

-- 11. Clean up any orphaned data
-- Mark expired invitations
UPDATE invitations
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at < NOW();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON invitations TO anon;
GRANT ALL ON invitations TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE invitations IS 'Stores pending invitations for users who do not yet have accounts';
COMMENT ON COLUMN invitations.invitation_token IS 'Unique token used in invitation links';
COMMENT ON FUNCTION check_user_exists IS 'Checks if a user exists by email address';
COMMENT ON FUNCTION accept_invitation IS 'Processes invitation acceptance and creates pin share';
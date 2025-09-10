-- WORKING PIN SHARING SQL FUNCTIONS
-- This file contains the database functions that work for pin sharing (without file copying)
-- Date: 2025-09-10
-- Commit: "Pin share complete. Data share next." (a977d7a)
--
-- RESTORE INSTRUCTIONS:
-- If pin sharing breaks in future versions, run this SQL in Supabase SQL Editor
-- to restore working pin sharing functionality.

-- Drop any existing functions first
DROP FUNCTION IF EXISTS copy_pin_to_user(uuid,text);
DROP FUNCTION IF EXISTS check_user_exists_by_email(text);
DROP FUNCTION IF EXISTS copy_pin_files_between_users(uuid,uuid,uuid);

-- Create the working pin copy function
CREATE OR REPLACE FUNCTION copy_pin_to_user(
  original_pin_id UUID,
  target_user_email TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  copied_pin_id UUID,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_pin RECORD;
  target_user_id UUID;
  new_pin_id UUID;
BEGIN
  -- Step 1: Validate the target user exists
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_user_email;
  
  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Target user not found'::TEXT;
    RETURN;
  END IF;
  
  -- Step 2: Get the original pin
  SELECT * INTO original_pin
  FROM pins
  WHERE id = original_pin_id;
  
  IF original_pin.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Original pin not found'::TEXT;
    RETURN;
  END IF;
  
  -- Step 3: Create the pin copy (this bypasses RLS due to SECURITY DEFINER)
  INSERT INTO pins (
    user_id,
    label,
    notes,
    lat,
    lng,
    label_visible,
    project_id,
    created_at,
    updated_at
  ) VALUES (
    target_user_id,
    original_pin.label || ' (Copy)',
    original_pin.notes,
    original_pin.lat,
    original_pin.lng,
    original_pin.label_visible,
    NULL, -- Don't copy project associations
    NOW(),
    NOW()
  )
  RETURNING id INTO new_pin_id;
  
  -- Step 4: Return success
  RETURN QUERY SELECT TRUE, new_pin_id, 'Pin copied successfully'::TEXT;
END;
$$;

-- Create the user validation function
CREATE OR REPLACE FUNCTION check_user_exists_by_email(user_email TEXT)
RETURNS TABLE (
  user_exists BOOLEAN,
  user_id UUID,
  display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user RECORD;
BEGIN
  -- Look up user in auth.users table
  SELECT 
    au.id as user_id,
    COALESCE(p.email, au.email) as display_name
  INTO found_user
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.email = user_email
  LIMIT 1;
  
  IF found_user.user_id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, found_user.user_id, found_user.display_name;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION copy_pin_to_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_exists_by_email(TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION copy_pin_to_user IS 'WORKING VERSION: Safely copy a pin from one user to another, bypassing RLS restrictions';
COMMENT ON FUNCTION check_user_exists_by_email IS 'WORKING VERSION: Check if a user exists by email address and return their details';
-- Strengthen password policy for Supabase Auth
-- This migration configures server-side password requirements

-- Note: Supabase Auth password policy is configured via the dashboard at:
-- Settings > Authentication > Password Policy
--
-- Recommended settings:
-- - Minimum password length: 10 characters
-- - Require uppercase: Yes
-- - Require lowercase: Yes
-- - Require numbers: Yes
-- - Require special characters: Yes
--
-- However, we can add a database trigger to enforce additional validation
-- if needed in the future.

-- Create a function to validate password strength (optional - for future use)
CREATE OR REPLACE FUNCTION auth.validate_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check minimum length
  IF LENGTH(password) < 10 THEN
    RETURN FALSE;
  END IF;

  -- Check for uppercase letter
  IF NOT password ~ '[A-Z]' THEN
    RETURN FALSE;
  END IF;

  -- Check for lowercase letter
  IF NOT password ~ '[a-z]' THEN
    RETURN FALSE;
  END IF;

  -- Check for number
  IF NOT password ~ '[0-9]' THEN
    RETURN FALSE;
  END IF;

  -- Check for special character
  IF NOT password ~ '[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the password policy
COMMENT ON FUNCTION auth.validate_password_strength IS
'Validates password strength requirements:
- Minimum 10 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Password policy strengthened. Please also configure in Supabase Dashboard:';
  RAISE NOTICE 'Settings > Authentication > Password Policy';
  RAISE NOTICE 'Set minimum length to 10 characters and enable character type requirements.';
END $$;

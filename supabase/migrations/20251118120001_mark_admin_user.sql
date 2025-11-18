-- Mark Admin User
-- Run this after the analytics system migration to mark your account as admin
-- Replace 'your-email@example.com' with your actual email address

UPDATE user_profiles
SET is_admin = true
WHERE email = 'your-email@example.com';

-- Verify admin status
SELECT id, email, is_admin
FROM user_profiles
WHERE is_admin = true;

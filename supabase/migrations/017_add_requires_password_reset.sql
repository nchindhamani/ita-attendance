-- Add requires_password_reset column to profiles table
-- This flag indicates that the user must reset their password on first login

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS requires_password_reset BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN profiles.requires_password_reset IS 'Set to true when user is created with temporary password or when placeholder email is updated to valid email. User must reset password on first login.';




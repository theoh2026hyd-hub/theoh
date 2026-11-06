-- Add auth columns to user_details for email/password and Google sign-in
ALTER TABLE user_details
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';

-- Index for faster auth lookups
CREATE INDEX IF NOT EXISTS idx_user_details_user_id ON user_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_details_email ON user_details(email);

-- Sync full_name into customer_name when present
UPDATE user_details
SET full_name = customer_name
WHERE full_name IS NULL AND customer_name IS NOT NULL AND customer_name <> 'User';

COMMENT ON COLUMN user_details.user_id IS 'Supabase auth.users id';
COMMENT ON COLUMN user_details.email IS 'User email from signup or Google OAuth';
COMMENT ON COLUMN user_details.full_name IS 'Full name from signup or Google profile';
COMMENT ON COLUMN user_details.auth_provider IS 'email or google';

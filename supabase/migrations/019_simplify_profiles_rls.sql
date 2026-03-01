-- Simplify profiles RLS to fix infinite recursion
-- Remove all policies and recreate with the simplest possible approach

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- SIMPLEST APPROACH: Just allow users to read/update their own profile
-- For admin access to all profiles, we'll handle it via backend API with service role
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: Admin access to all profiles will be handled via:
-- 1. Backend API using service_role key (bypasses RLS)
-- 2. Or we can add admin policies later using a different approach




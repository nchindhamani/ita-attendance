-- Fix infinite recursion in profiles RLS policy
-- The issue occurs when policies on other tables query profiles to check admin role
-- This creates a circular dependency

-- Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a SECURITY DEFINER function to get user role without triggering RLS
-- This function bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN (SELECT role::text FROM profiles WHERE id = user_id LIMIT 1);
END;
$$;

-- Simple policy: Users can read their own profile
-- This is the most basic policy that shouldn't cause recursion
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can read all profiles (for admin dashboard)
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id  -- Users can always read their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can read all profiles
  );

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id  -- Users can update their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can update all profiles
  )
  WITH CHECK (
    auth.uid() = id  -- Users can only update their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can update any profile
  );


-- Add RLS policy to allow users to read their own profile
-- This is required for the Python API to query profiles with authenticated users

-- Policy: Users can read their own profile
create policy "Users can read their own profile"
  on profiles
  for select
  using (auth.uid() = id);

-- Policy: Users can update their own profile (if needed)
create policy "Users can update their own profile"
  on profiles
  for update
  using (auth.uid() = id);


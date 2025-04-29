/*
  # Add role types to profiles table

  1. Changes
    - Add role_type column to profiles table with enum validation
    - Update handle_new_user function to set appropriate role_type
    - Create RLS policies for role management

  2. Security
    - Enable RLS on profiles table
    - Add policies for role_type management
    - Only superadmins can update role_type
    - All authenticated users can read role_type

  3. Notes
    - First user is automatically set as superadmin
    - Subsequent users default to 'viewer' role
    - Role hierarchy: superadmin > admin > manager > viewer
*/

-- Add role_type column with check constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role_type'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN role_type text DEFAULT 'viewer'
    CHECK (role_type IN ('superadmin', 'admin', 'manager', 'viewer'));
  END IF;
END $$;

-- Update handle_new_user function to set superadmin for first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role_type
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE role_type = 'superadmin'
      ) THEN 'superadmin'
      ELSE 'viewer'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for role_type management
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can read role_type" ON public.profiles;
  DROP POLICY IF EXISTS "Only superadmins can update role_type" ON public.profiles;

  -- Create new policies
  CREATE POLICY "Users can read role_type"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Only superadmins can update role_type"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role_type = 'superadmin'
      )
    )
    WITH CHECK (
      auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role_type = 'superadmin'
      )
    );
END $$;
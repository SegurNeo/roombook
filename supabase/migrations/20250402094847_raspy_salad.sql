/*
  # Add role_type column and update policies

  1. Changes
    - Add role_type column with check constraint
    - Update handle_new_user function to set superadmin for first user
    - Create RLS policies for role_type management

  2. Security
    - Enable RLS on profiles table
    - Add policy for reading role_type
    - Add policy for updating role_type (superadmin only)
*/

-- First drop the existing policies that depend on the role_type column
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Only superadmins can update role_type" ON public.profiles;
  DROP POLICY IF EXISTS "Users can read role_type" ON public.profiles;
END $$;

-- Now add the role_type column if it doesn't exist
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
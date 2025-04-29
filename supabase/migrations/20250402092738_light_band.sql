/*
  # Update handle_new_user function for role_type

  1. Changes
    - Update handle_new_user function to set superadmin role for first user
    - Add RLS policies for role_type access

  2. Security
    - Allow all authenticated users to read role_type
    - Only superadmins can update role_type
*/

-- Update handle_new_user function to set superadmin role for first user
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
        WHERE role_type IS NOT NULL
      ) THEN 'superadmin'
      ELSE 'member'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for role_type
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
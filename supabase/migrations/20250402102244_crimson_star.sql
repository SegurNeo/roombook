/*
  # Fix role type management

  1. Changes
    - Update handle_new_user function to properly handle superadmin role assignments
    - Add role_type column with proper constraints
    - Create policies for role type management
    - Fix policy syntax for role updates

  2. Security
    - Enable RLS
    - Add policies for profile management
    - Add constraints for valid role types
*/

-- First ensure role_type column exists with proper constraints
DO $$ 
BEGIN
  -- Add role_type column if it doesn't exist
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

-- Update handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id,
      full_name,
      role_type,
      onboarding_completed,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM profiles 
          WHERE role_type = 'superadmin'
        ) THEN 'superadmin'
        ELSE 'viewer'
      END,
      false,
      now(),
      now()
    );
  EXCEPTION 
    WHEN unique_violation THEN
      NULL;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Error creating profile: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profile management
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "New profiles can be created on signup" ON public.profiles;
  DROP POLICY IF EXISTS "Only superadmins can update role_type" ON public.profiles;
  
  -- Create consolidated policies
  CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

  CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "New profiles can be created on signup"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

  -- Policy for role type updates
  CREATE POLICY "Only superadmins can update roles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role_type = 'superadmin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role_type = 'superadmin'
      )
    );
END $$;
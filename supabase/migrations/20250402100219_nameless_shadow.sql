/*
  # Fix user signup function and schema

  1. Changes
    - Update handle_new_user function to properly handle new user creation
    - Ensure all required columns exist with proper defaults
    - Clean up and consolidate RLS policies
    - Add proper constraints

  2. Security
    - Maintain existing RLS policies
    - Add proper constraints for role_type
*/

-- First ensure all required columns exist with proper constraints
DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role_type'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN role_type text DEFAULT 'viewer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;

  -- Add constraint for role_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_role_type_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_type_check 
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
      -- Profile already exists, ignore
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

-- Recreate RLS policies to ensure consistency
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
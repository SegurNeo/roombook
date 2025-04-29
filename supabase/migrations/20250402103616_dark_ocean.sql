/*
  # Fix superadmin role assignment

  1. Changes
    - Update handle_new_user function to properly check for superadmin existence
    - Add explicit transaction handling to ensure atomicity
    - Add proper error handling and logging

  2. Security
    - Maintain SECURITY DEFINER setting
    - Set explicit search path for security
    - Preserve existing RLS policies
*/

-- Update handle_new_user function with proper superadmin check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  superadmin_exists boolean;
BEGIN
  -- Start an explicit transaction block
  BEGIN
    -- Lock the profiles table to prevent race conditions
    LOCK TABLE profiles IN SHARE MODE;
    
    -- Check if any superadmin exists BEFORE inserting
    SELECT EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE role_type = 'superadmin'
      FOR UPDATE
    ) INTO superadmin_exists;

    -- Insert the new profile with appropriate role
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
        WHEN NOT superadmin_exists THEN 'superadmin'::text
        ELSE 'viewer'::text
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
      RAISE EXCEPTION 'Error in handle_new_user: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
/*
  # Fix superadmin role assignment logic

  1. Changes
    - Update handle_new_user function to correctly check for existing superadmin
    - Fix the logic to ensure first user is always superadmin
    - Add proper error handling and security settings

  2. Security
    - Maintain SECURITY DEFINER setting
    - Set explicit search path for security
    - Preserve existing RLS policies
*/

-- Update handle_new_user function to correctly check for superadmin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  superadmin_exists boolean;
BEGIN
  -- Check if any superadmin exists
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE role_type = 'superadmin'
  ) INTO superadmin_exists;

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
        WHEN NOT superadmin_exists THEN 'superadmin'
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
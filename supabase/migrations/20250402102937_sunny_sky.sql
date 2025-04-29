/*
  # Fix handle_new_user function to preserve superadmin roles

  1. Changes
    - Update handle_new_user function to preserve existing superadmin roles
    - Fix logic for determining superadmin status for new users
    - Add proper error handling and security settings

  2. Security
    - Maintain SECURITY DEFINER setting
    - Set explicit search path for security
    - Preserve existing RLS policies
*/

-- Update handle_new_user function to preserve superadmin roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
  ) INTO is_first_user;

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
        WHEN is_first_user THEN 'superadmin'
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
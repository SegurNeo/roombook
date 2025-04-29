/*
  # Fix handle_new_user function for first user superadmin

  1. Changes
    - Use a more robust check for first user
    - Add explicit transaction management
    - Improve error handling
    - Fix role type assignment logic
    - Add better logging

  2. Security
    - Maintain SECURITY DEFINER setting
    - Set explicit search path for security
    - Preserve existing RLS policies
*/

-- Update handle_new_user function with proper first user check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  lock_obtained boolean;
  first_user boolean;
  assigned_role text;
BEGIN
  -- Try to obtain an advisory lock (lock_id: 1)
  SELECT pg_try_advisory_xact_lock(1) INTO lock_obtained;
  
  IF NOT lock_obtained THEN
    RAISE EXCEPTION 'Could not obtain lock for new user creation';
  END IF;

  BEGIN
    -- Check if this is the first user EVER in the system
    SELECT NOT EXISTS (
      SELECT 1 
      FROM profiles 
      LIMIT 1
    ) INTO first_user;

    -- Determine the role to assign
    IF first_user THEN
      assigned_role := 'superadmin';
    ELSE
      assigned_role := 'viewer';
    END IF;

    -- Insert the new profile
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
      assigned_role,
      false,
      now(),
      now()
    );

    -- Log the assignment for debugging
    RAISE NOTICE 'User % assigned role: % (first user: %)', NEW.id, assigned_role, first_user;

    RETURN NEW;

  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, ignore
      RAISE NOTICE 'Profile already exists for user %', NEW.id;
      RETURN NEW;
    WHEN OTHERS THEN
      -- Log other errors
      RAISE EXCEPTION 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  END;
END;
$$;
/*
  # Fix superadmin role assignment

  1. Changes
    - Update handle_new_user function to use serializable transaction
    - Add explicit transaction management
    - Improve locking strategy
    - Add better error handling
    - Fix role type assignment logic

  2. Security
    - Maintain SECURITY DEFINER setting
    - Set explicit search path for security
    - Preserve existing RLS policies
*/

-- Update handle_new_user function with serializable transaction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  superadmin_exists boolean;
  assigned_role text;
BEGIN
  -- Start a serializable transaction to prevent race conditions
  BEGIN
    -- Set the transaction isolation level to serializable
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    
    -- Take an exclusive lock on the profiles table
    LOCK TABLE profiles IN EXCLUSIVE MODE;
    
    -- Check if any superadmin exists
    SELECT EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE role_type = 'superadmin'
      FOR UPDATE
    ) INTO superadmin_exists;

    -- Determine the role to assign
    IF NOT superadmin_exists THEN
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
    RAISE NOTICE 'User % assigned role: %', NEW.id, assigned_role;

  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, ignore
      RAISE NOTICE 'Profile already exists for user %', NEW.id;
      NULL;
    WHEN serialization_failure THEN
      -- Handle serialization failures
      RAISE EXCEPTION 'Transaction serialization failed, please retry';
    WHEN OTHERS THEN
      -- Log other errors
      RAISE EXCEPTION 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
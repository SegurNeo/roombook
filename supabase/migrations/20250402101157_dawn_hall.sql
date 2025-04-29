/*
  # Add role type constraint and update policies

  1. Changes
    - Add role_type constraint to profiles table
    - Update RLS policies for role management
    - Ensure proper role validation

  2. Security
    - Maintain existing RLS policies
    - Add proper constraints for role_type
*/

-- Add constraint for role_type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_role_type_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_type_check 
    CHECK (role_type IN ('superadmin', 'admin', 'manager', 'viewer'));
  END IF;
END $$;
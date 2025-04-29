/*
  # Fix first organization user superadmin role

  1. Changes
    - Add organization_superadmin column to organizations table
    - Update create_organization_and_update_profile function to handle superadmin role
    - Add RLS policies for organization management
    - Ensure first user of an organization becomes superadmin

  2. Security
    - Maintain RLS policies
    - Add proper constraints
    - Use advisory locks to prevent race conditions
*/

-- Add organization_superadmin to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS organization_superadmin uuid REFERENCES auth.users(id);

-- Update create_organization_and_update_profile function
CREATE OR REPLACE FUNCTION create_organization_and_update_profile(
  org_name text,
  org_role text,
  org_team_size text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  lock_obtained boolean;
BEGIN
  -- Try to obtain an advisory lock
  SELECT pg_try_advisory_xact_lock(2) INTO lock_obtained;
  
  IF NOT lock_obtained THEN
    RAISE EXCEPTION 'Could not obtain lock for organization creation';
  END IF;

  BEGIN
    -- Create new organization
    INSERT INTO public.organizations (
      name, 
      type, 
      team_size, 
      created_by,
      organization_superadmin
    )
    VALUES (
      org_name, 
      org_role, 
      org_team_size, 
      auth.uid(),
      auth.uid()  -- Set the creator as the organization superadmin
    )
    RETURNING id INTO new_org_id;

    -- Update user's profile
    UPDATE public.profiles
    SET 
      organization_id = new_org_id,
      onboarding_completed = true,
      role_type = 'superadmin',  -- Set the creator's role to superadmin
      updated_at = now()
    WHERE id = auth.uid();

    RETURN new_org_id;
  EXCEPTION 
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Organization already exists';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Error creating organization: %', SQLERRM;
  END;
END;
$$;

-- Update handle_new_user function to set initial role as viewer
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
      'viewer',  -- Always start as viewer
      false,
      now(),
      now()
    );

    RETURN NEW;
  EXCEPTION 
    WHEN unique_violation THEN
      RAISE NOTICE 'Profile already exists for user %', NEW.id;
      RETURN NEW;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  END;
END;
$$;

-- Add RLS policies for organization management
CREATE POLICY "Organization superadmins can update organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (organization_superadmin = auth.uid())
  WITH CHECK (organization_superadmin = auth.uid());

-- Add constraint to ensure only one superadmin per organization
ALTER TABLE public.organizations
ADD CONSTRAINT organization_single_superadmin UNIQUE (id, organization_superadmin);
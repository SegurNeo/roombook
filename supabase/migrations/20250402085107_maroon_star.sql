/*
  # Create organizations table and update schema

  1. New Tables
    - `organizations`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `role` (text, required)
      - `team_size` (text, required)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Changes
    - Add organization_id to profiles table
    - Move role and team_size from profiles to organizations
    - Add RLS policies for organizations

  3. Security
    - Enable RLS on organizations table
    - Add policies for organization access
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  team_size text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add organization_id to profiles
ALTER TABLE public.profiles
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Create RLS policies for organizations
CREATE POLICY "Users can read organizations they belong to"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.organization_id = organizations.id
    AND profiles.id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create their own organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Organization creators can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Function to handle organization creation and profile update
CREATE OR REPLACE FUNCTION create_organization_and_update_profile(
  org_name text,
  org_role text,
  org_team_size text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create new organization
  INSERT INTO public.organizations (name, role, team_size, created_by)
  VALUES (org_name, org_role, org_team_size, auth.uid())
  RETURNING id INTO new_org_id;

  -- Update user's profile
  UPDATE public.profiles
  SET organization_id = new_org_id,
      onboarding_completed = true
  WHERE id = auth.uid();

  RETURN new_org_id;
END;
$$;

-- Migrate existing data
DO $$
BEGIN
  -- For each profile with role and team_size, create an organization
  INSERT INTO public.organizations (name, role, team_size, created_by)
  SELECT 
    COALESCE(profiles.org_name, 'My Organization'),
    profiles.role,
    profiles.team_size,
    profiles.id
  FROM profiles
  WHERE profiles.role IS NOT NULL
    AND profiles.team_size IS NOT NULL
    AND profiles.organization_id IS NULL;

  -- Update profiles with their organization_id
  UPDATE profiles p
  SET organization_id = o.id
  FROM organizations o
  WHERE o.created_by = p.id
    AND p.organization_id IS NULL;

  -- Remove old columns from profiles
  ALTER TABLE profiles
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS team_size,
  DROP COLUMN IF EXISTS org_name;
END;
$$;
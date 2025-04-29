/*
  # Fix Assets RLS Policies

  1. Changes
    - Update RLS policies for assets table
    - Add organization_id check to policies
    - Fix created_by constraint
    - Ensure proper role-based access

  2. Security
    - Enable RLS
    - Add proper constraints
    - Enforce organization-based access
*/

-- First ensure RLS is enabled
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can create assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can view assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can update assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can delete assets in their organization" ON assets;

-- Create new policies with proper organization and role checks
CREATE POLICY "Users can create assets in their organization"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = assets.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can view assets in their organization"
  ON assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = assets.organization_id
    )
  );

CREATE POLICY "Users can update assets in their organization"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = assets.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete assets in their organization"
  ON assets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = assets.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Update the check_created_by function to also verify organization membership
CREATE OR REPLACE FUNCTION check_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the user's organization_id
  NEW.organization_id := (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid()
  );
  
  -- Ensure created_by matches authenticated user
  IF NEW.created_by != auth.uid() THEN
    RAISE EXCEPTION 'created_by must match the authenticated user';
  END IF;

  -- Ensure user has an organization
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'user must belong to an organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
/*
  # Fix Assets and Rooms RLS Policies

  This migration updates the RLS policies for assets and rooms tables to ensure:
  1. Users can only access data within their organization
  2. Only users with appropriate roles can perform write operations
  3. The created_by field is properly enforced
*/

-- First, verify and update assets table RLS policies
DROP POLICY IF EXISTS "Users can create assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can delete assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can update assets in their organization" ON assets;
DROP POLICY IF EXISTS "Users can view assets in their organization" ON assets;

-- Recreate policies with proper checks
CREATE POLICY "Users can create assets in their organization"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid() -- Ensure created_by matches the authenticated user
  );

CREATE POLICY "Users can view assets in their organization"
  ON assets
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update assets in their organization"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete assets in their organization"
  ON assets
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Update rooms table RLS policies
DROP POLICY IF EXISTS "Users can create rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can delete rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can update rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can view rooms in their organization's assets" ON rooms;

-- Recreate policies with proper checks
CREATE POLICY "Users can create rooms in their organization's assets"
  ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    asset_id IN (
      SELECT id FROM assets
      WHERE assets.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_type IN ('superadmin', 'admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can view rooms in their organization's assets"
  ON rooms
  FOR SELECT
  TO authenticated
  USING (
    asset_id IN (
      SELECT id FROM assets
      WHERE assets.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update rooms in their organization's assets"
  ON rooms
  FOR UPDATE
  TO authenticated
  USING (
    asset_id IN (
      SELECT id FROM assets
      WHERE assets.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_type IN ('superadmin', 'admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can delete rooms in their organization's assets"
  ON rooms
  FOR DELETE
  TO authenticated
  USING (
    asset_id IN (
      SELECT id FROM assets
      WHERE assets.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_type IN ('superadmin', 'admin')
      )
    )
  );

-- Add trigger to ensure created_by matches auth.uid()
CREATE OR REPLACE FUNCTION check_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by != auth.uid() THEN
    RAISE EXCEPTION 'created_by must match the authenticated user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_created_by_matches_user ON assets;
CREATE TRIGGER ensure_created_by_matches_user
  BEFORE INSERT ON assets
  FOR EACH ROW
  EXECUTE FUNCTION check_created_by();
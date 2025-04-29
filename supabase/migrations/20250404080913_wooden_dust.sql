/*
  # Fix Amenities RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Create new policies with proper organization checks
    - Ensure proper role-based access control
    - Fix policy conditions

  2. Security
    - Maintain RLS enabled
    - Add proper constraints
    - Enforce organization-based access
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view amenities in their organization" ON amenities;
DROP POLICY IF EXISTS "Users can create amenities in their organization" ON amenities;
DROP POLICY IF EXISTS "Users can update amenities in their organization" ON amenities;
DROP POLICY IF EXISTS "Users can delete amenities in their organization" ON amenities;

-- Create new policies with proper checks
CREATE POLICY "Users can view amenities in their organization"
  ON amenities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = amenities.organization_id
    )
  );

CREATE POLICY "Users can create amenities in their organization"
  ON amenities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = amenities.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update amenities in their organization"
  ON amenities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = amenities.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete amenities in their organization"
  ON amenities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = amenities.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Ensure RLS is enabled
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
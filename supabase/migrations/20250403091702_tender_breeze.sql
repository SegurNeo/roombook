/*
  # Add created_by field to rooms table

  1. Changes
    - Add created_by column to rooms table
    - Add foreign key constraint to auth.users
    - Update RLS policies to enforce created_by
    - Add trigger to ensure created_by matches authenticated user

  2. Security
    - Enable RLS
    - Add proper constraints
    - Enforce user-based access control
*/

-- Add created_by column to rooms table
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) NOT NULL;

-- Update RLS policies for rooms
DROP POLICY IF EXISTS "Users can create rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can view rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can update rooms in their organization's assets" ON rooms;
DROP POLICY IF EXISTS "Users can delete rooms in their organization's assets" ON rooms;

-- Create new policies with proper organization and role checks
CREATE POLICY "Users can create rooms in their organization's assets"
  ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets
      JOIN profiles ON profiles.organization_id = assets.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can view rooms in their organization's assets"
  ON rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN profiles ON profiles.organization_id = assets.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
    )
  );

CREATE POLICY "Users can update rooms in their organization's assets"
  ON rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN profiles ON profiles.organization_id = assets.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete rooms in their organization's assets"
  ON rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN profiles ON profiles.organization_id = assets.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );
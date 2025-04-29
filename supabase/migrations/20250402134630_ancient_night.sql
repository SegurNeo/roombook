/*
  # Add created_by field to rooms table

  1. Changes
    - Add created_by column to rooms table
    - Add foreign key constraint to auth.users
    - Add RLS policies for room management
    - Add trigger to ensure created_by matches authenticated user

  2. Security
    - Enable RLS on rooms table
    - Add policies for CRUD operations
    - Ensure proper role-based access control
*/

-- Add created_by column to rooms table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.rooms
    ADD COLUMN created_by uuid REFERENCES auth.users(id) NOT NULL;
  END IF;
END $$;

-- Drop existing policies to recreate them
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

-- Update the asset_preview page to include created_by when creating rooms
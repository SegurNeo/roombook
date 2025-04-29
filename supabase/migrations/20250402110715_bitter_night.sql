/*
  # Create Assets and Rooms Tables

  1. New Tables
    - `assets`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (jsonb)
      - `reference` (text, optional)
      - `bathrooms` (integer)
      - `photos` (text[])
      - `purchase_price` (numeric, optional)
      - `purchase_date` (date, optional)
      - `management_model` (text)
      - `monthly_rent` (numeric, optional)
      - `management_percentage` (numeric, optional)
      - `amenities` (text[])
      - `organization_id` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `rooms`
      - `id` (uuid, primary key)
      - `asset_id` (uuid)
      - `name` (text)
      - `capacity` (text)
      - `location` (text)
      - `bathroom` (text)
      - `description` (text)
      - `photos` (text[])
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for CRUD operations based on organization membership
    - Only allow organization members to access their organization's assets

  3. Constraints
    - Foreign key relationships
    - Check constraints for valid values
    - Timestamps auto-update
*/

-- Create assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address jsonb NOT NULL,
  reference text,
  bathrooms integer NOT NULL CHECK (bathrooms >= 0),
  photos text[] DEFAULT ARRAY[]::text[],
  purchase_price numeric CHECK (purchase_price > 0),
  purchase_date date,
  management_model text CHECK (management_model IN ('rent-to-rent', 'full-management', 'property')),
  monthly_rent numeric CHECK (monthly_rent > 0),
  management_percentage numeric CHECK (management_percentage BETWEEN 0 AND 100),
  amenities text[] DEFAULT ARRAY[]::text[],
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rooms table
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity text NOT NULL CHECK (capacity IN ('single', 'double')),
  location text NOT NULL CHECK (location IN ('exterior', 'interior')),
  bathroom text NOT NULL CHECK (bathroom IN ('ensuite', 'shared')),
  description text,
  photos text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for assets
CREATE POLICY "Users can view assets in their organization"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = assets.organization_id
    )
  );

CREATE POLICY "Users can create assets in their organization"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can update assets in their organization"
  ON public.assets
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
  ON public.assets
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

-- Create policies for rooms
CREATE POLICY "Users can view rooms in their organization's assets"
  ON public.rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN assets ON assets.organization_id = profiles.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
    )
  );

CREATE POLICY "Users can create rooms in their organization's assets"
  ON public.rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN assets ON assets.organization_id = profiles.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = asset_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can update rooms in their organization's assets"
  ON public.rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN assets ON assets.organization_id = profiles.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete rooms in their organization's assets"
  ON public.rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN assets ON assets.organization_id = profiles.organization_id
      WHERE profiles.id = auth.uid()
      AND assets.id = rooms.asset_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );
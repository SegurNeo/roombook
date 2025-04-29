/*
  # Create amenities table

  1. New Tables
    - `amenities`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `organization_id` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for CRUD operations based on organization membership
    - Only allow organization members to access their organization's amenities

  3. Constraints
    - Foreign key relationships
    - Unique name per organization
    - Timestamps auto-update
*/

-- Create amenities table
CREATE TABLE public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure unique amenity names within an organization
  UNIQUE(name, organization_id)
);

-- Enable RLS
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_amenities_updated_at
  BEFORE UPDATE ON public.amenities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for amenities
CREATE POLICY "Users can view amenities in their organization"
  ON public.amenities
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
  ON public.amenities
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
  ON public.amenities
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
  ON public.amenities
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

-- Add indexes for better performance
CREATE INDEX amenities_organization_id_idx ON public.amenities(organization_id);
CREATE INDEX amenities_created_by_idx ON public.amenities(created_by);
/*
  # Create Services Table

  1. New Tables
    - `services`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `organization_id` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Only allow organization members to access their organization's services

  3. Constraints
    - Foreign key relationships
    - Unique service names within an organization
    - Timestamps auto-update
*/

-- Create services table
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure unique service names within an organization
  UNIQUE(name, organization_id)
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for services
CREATE POLICY "Users can view services in their organization"
  ON public.services
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = services.organization_id
    )
  );

CREATE POLICY "Users can create services in their organization"
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = services.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update services in their organization"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = services.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete services in their organization"
  ON public.services
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = services.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Add indexes for better performance
CREATE INDEX services_organization_id_idx ON public.services(organization_id);
CREATE INDEX services_created_by_idx ON public.services(created_by);
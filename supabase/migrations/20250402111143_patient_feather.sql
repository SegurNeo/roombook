/*
  # Create Customers Table

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text, unique)
      - `phone_prefix` (text)
      - `phone_number` (text)
      - `id_number` (text)
      - `id_document` (text, optional)
      - `notes` (text, optional)
      - `organization_id` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `payer_type` (text)
      - `payer_name` (text)
      - `payer_email` (text)
      - `payer_phone_prefix` (text)
      - `payer_phone_number` (text)
      - `payer_id_number` (text)
      - `payer_id_document` (text)

  2. Security
    - Enable RLS
    - Add policies for CRUD operations based on organization membership
    - Only allow organization members to access their organization's customers

  3. Constraints
    - Foreign key relationships
    - Check constraints for valid values
    - Timestamps auto-update
*/

-- Create customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone_prefix text NOT NULL,
  phone_number text NOT NULL,
  id_number text NOT NULL,
  id_document text,
  notes text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Payer information (optional)
  payer_type text CHECK (payer_type IN ('person', 'company')),
  payer_name text,
  payer_email text,
  payer_phone_prefix text,
  payer_phone_number text,
  payer_id_number text,
  payer_id_document text,
  -- Add unique constraint for email within organization
  CONSTRAINT customers_email_organization_unique UNIQUE (email, organization_id)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for customers
CREATE POLICY "Users can view customers in their organization"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = customers.organization_id
    )
  );

CREATE POLICY "Users can create customers in their organization"
  ON public.customers
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

CREATE POLICY "Users can update customers in their organization"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = customers.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete customers in their organization"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = customers.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Add indexes for better performance
CREATE INDEX customers_organization_id_idx ON public.customers(organization_id);
CREATE INDEX customers_email_idx ON public.customers(email);
CREATE INDEX customers_created_by_idx ON public.customers(created_by);
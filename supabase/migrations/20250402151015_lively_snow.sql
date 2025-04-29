/*
  # Create Bookings Table

  1. New Tables
    - `bookings`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `room_id` (uuid, references rooms)
      - `start_date` (date)
      - `end_date` (date)
      - `rent_price` (numeric)
      - `deposit_months` (integer)
      - `deposit_amount` (numeric)
      - `notice_period_months` (integer)
      - `rent_calculation` (text)
      - `status` (text)
      - `organization_id` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Only allow organization members to access their organization's bookings

  3. Constraints
    - Foreign key relationships
    - Check constraints for valid values
    - Timestamps auto-update
*/

-- Create bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  rent_price numeric NOT NULL CHECK (rent_price > 0),
  deposit_months integer NOT NULL CHECK (deposit_months > 0),
  deposit_amount numeric NOT NULL CHECK (deposit_amount > 0),
  notice_period_months integer NOT NULL CHECK (notice_period_months > 0),
  rent_calculation text NOT NULL CHECK (rent_calculation IN ('full', 'natural')),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'completed')) DEFAULT 'active',
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Add constraint to ensure end_date is after start_date
  CONSTRAINT bookings_dates_check CHECK (end_date > start_date)
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for bookings
CREATE POLICY "Users can view bookings in their organization"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bookings.organization_id
    )
  );

CREATE POLICY "Users can create bookings in their organization"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update bookings in their organization"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bookings.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can delete bookings in their organization"
  ON public.bookings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bookings.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

-- Add indexes for better performance
CREATE INDEX bookings_organization_id_idx ON public.bookings(organization_id);
CREATE INDEX bookings_customer_id_idx ON public.bookings(customer_id);
CREATE INDEX bookings_room_id_idx ON public.bookings(room_id);
CREATE INDEX bookings_created_by_idx ON public.bookings(created_by);
CREATE INDEX bookings_status_idx ON public.bookings(status);
CREATE INDEX bookings_dates_idx ON public.bookings(start_date, end_date);
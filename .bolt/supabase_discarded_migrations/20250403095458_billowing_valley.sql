/*
  # Create rent transactions table and functions

  1. New Tables
    - `rent_transactions`
      - `id` (uuid, primary key)
      - `booking_id` (uuid, references bookings)
      - `customer_id` (uuid, references customers)
      - `room_id` (uuid, references rooms)
      - `due_date` (date)
      - `amount` (numeric)
      - `type` (text: 'rent' or 'deposit')
      - `status` (text: 'pending', 'paid', 'late')
      - `organization_id` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `generate_rent_transactions`: Creates transaction records for a booking
    - `update_rent_transaction_status`: Updates transaction status based on date

  3. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Only allow organization members to access their transactions
*/

-- Create rent_transactions table
CREATE TABLE public.rent_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  due_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('rent', 'deposit')),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'late')) DEFAULT 'pending',
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rent_transactions ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_rent_transactions_updated_at
  BEFORE UPDATE ON public.rent_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate rent transactions for a booking
CREATE OR REPLACE FUNCTION generate_rent_transactions(booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_record RECORD;
  payment_date date;
  first_month_rent numeric;
BEGIN
  -- Get booking details
  SELECT 
    b.*,
    c.id as customer_id,
    r.id as room_id,
    a.organization_id
  INTO booking_record
  FROM bookings b
  JOIN customers c ON c.id = b.customer_id
  JOIN rooms r ON r.id = b.room_id
  JOIN assets a ON a.id = r.asset_id
  WHERE b.id = booking_id;

  -- Insert deposit transaction
  INSERT INTO rent_transactions (
    booking_id,
    customer_id,
    room_id,
    due_date,
    amount,
    type,
    organization_id
  ) VALUES (
    booking_id,
    booking_record.customer_id,
    booking_record.room_id,
    booking_record.start_date,
    booking_record.deposit_amount,
    'deposit',
    booking_record.organization_id
  );

  -- Calculate first month's rent
  IF booking_record.rent_calculation = 'natural' THEN
    -- Pro-rate first month
    first_month_rent := booking_record.rent_price * 
      (EXTRACT(DAY FROM DATE_TRUNC('month', booking_record.start_date) + INTERVAL '1 month' - booking_record.start_date) / 
       EXTRACT(DAY FROM DATE_TRUNC('month', booking_record.start_date) + INTERVAL '1 month' - DATE_TRUNC('month', booking_record.start_date)));
  ELSE
    -- Full month regardless of start date
    first_month_rent := booking_record.rent_price;
  END IF;

  -- Insert first month's rent transaction
  INSERT INTO rent_transactions (
    booking_id,
    customer_id,
    room_id,
    due_date,
    amount,
    type,
    organization_id
  ) VALUES (
    booking_id,
    booking_record.customer_id,
    booking_record.room_id,
    booking_record.start_date,
    first_month_rent,
    'rent',
    booking_record.organization_id
  );

  -- Generate remaining monthly rent transactions
  payment_date := DATE_TRUNC('month', booking_record.start_date) + INTERVAL '1 month';
  
  WHILE payment_date < booking_record.end_date LOOP
    INSERT INTO rent_transactions (
      booking_id,
      customer_id,
      room_id,
      due_date,
      amount,
      type,
      organization_id
    ) VALUES (
      booking_id,
      booking_record.customer_id,
      booking_record.room_id,
      payment_date,
      booking_record.rent_price,
      'rent',
      booking_record.organization_id
    );
    
    payment_date := payment_date + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- Create function to update transaction status based on date
CREATE OR REPLACE FUNCTION update_rent_transaction_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update status to 'late' for unpaid transactions past due date
  UPDATE rent_transactions
  SET status = 'late'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;

-- Create policies for rent_transactions
CREATE POLICY "Users can view transactions in their organization"
  ON public.rent_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rent_transactions.organization_id
    )
  );

CREATE POLICY "Users can update transactions in their organization"
  ON public.rent_transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rent_transactions.organization_id
      AND profiles.role_type IN ('superadmin', 'admin', 'manager')
    )
  );

-- Create indexes for better performance
CREATE INDEX rent_transactions_organization_id_idx ON public.rent_transactions(organization_id);
CREATE INDEX rent_transactions_booking_id_idx ON public.rent_transactions(booking_id);
CREATE INDEX rent_transactions_customer_id_idx ON public.rent_transactions(customer_id);
CREATE INDEX rent_transactions_room_id_idx ON public.rent_transactions(room_id);
CREATE INDEX rent_transactions_due_date_idx ON public.rent_transactions(due_date);
CREATE INDEX rent_transactions_status_idx ON public.rent_transactions(status);

-- Add trigger to generate transactions when a booking is created
CREATE OR REPLACE FUNCTION handle_new_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate rent transactions for the new booking
  PERFORM generate_rent_transactions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_booking();
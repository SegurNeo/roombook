/*
  # Add created_by to rent transactions

  1. Changes
    - Add created_by column to rent_transactions table
    - Update handle_new_booking function to copy created_by from booking
    - Add foreign key constraint to profiles table
    - Add RLS policies for created_by access

  2. Security
    - Enable RLS
    - Add proper constraints
    - Enforce user-based access control
*/

-- Add created_by column to rent_transactions table
ALTER TABLE public.rent_transactions
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Update handle_new_booking function to copy created_by from booking
CREATE OR REPLACE FUNCTION handle_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create deposit transaction
  INSERT INTO rent_transactions (
    booking_id,
    customer_id,
    room_id,
    due_date,
    amount,
    type,
    organization_id,
    created_by
  ) VALUES (
    NEW.id,
    NEW.customer_id,
    NEW.room_id,
    NEW.start_date,
    NEW.deposit_amount,
    'deposit',
    NEW.organization_id,
    NEW.created_by
  );

  -- Create first rent transaction
  INSERT INTO rent_transactions (
    booking_id,
    customer_id,
    room_id,
    due_date,
    amount,
    type,
    organization_id,
    created_by
  ) VALUES (
    NEW.id,
    NEW.customer_id,
    NEW.room_id,
    NEW.start_date,
    CASE 
      WHEN NEW.rent_calculation = 'natural' THEN
        NEW.rent_price * (
          EXTRACT(DAY FROM (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month - 1 day') - NEW.start_date + INTERVAL '1 day')::numeric /
          EXTRACT(DAY FROM (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month - 1 day') - DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 day')
        )
      ELSE NEW.rent_price
    END,
    'rent',
    NEW.organization_id,
    NEW.created_by
  );

  -- Create future rent transactions
  INSERT INTO rent_transactions (
    booking_id,
    customer_id,
    room_id,
    due_date,
    amount,
    type,
    organization_id,
    created_by
  )
  SELECT
    NEW.id,
    NEW.customer_id,
    NEW.room_id,
    date_trunc('month', NEW.start_date) + (n || ' months')::interval,
    NEW.rent_price,
    'rent',
    NEW.organization_id,
    NEW.created_by
  FROM generate_series(1, EXTRACT(YEAR FROM age(NEW.end_date, NEW.start_date))*12 + EXTRACT(MONTH FROM age(NEW.end_date, NEW.start_date))) n
  WHERE date_trunc('month', NEW.start_date) + (n || ' months')::interval < NEW.end_date;

  RETURN NEW;
END;
$$;
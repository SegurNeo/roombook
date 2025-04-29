/*
  # Fix foreign key relationships for created_by columns

  1. Changes
    - Update foreign key constraints to reference profiles table
    - Drop existing constraints
    - Add new constraints
    - Update all tables (assets, rooms, customers, bookings)

  2. Security
    - Maintain RLS policies
    - Keep existing permissions
*/

-- Drop existing foreign key constraints
DO $$ 
BEGIN
  -- Drop assets foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'assets_created_by_fkey'
  ) THEN
    ALTER TABLE public.assets DROP CONSTRAINT assets_created_by_fkey;
  END IF;

  -- Drop rooms foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rooms_created_by_fkey'
  ) THEN
    ALTER TABLE public.rooms DROP CONSTRAINT rooms_created_by_fkey;
  END IF;

  -- Drop customers foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customers_created_by_fkey'
  ) THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_created_by_fkey;
  END IF;

  -- Drop bookings foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_created_by_fkey'
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_created_by_fkey;
  END IF;
END $$;

-- Add new foreign key constraints referencing profiles table
ALTER TABLE public.assets
ADD CONSTRAINT assets_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.rooms
ADD CONSTRAINT rooms_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.customers
ADD CONSTRAINT customers_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- Update check_created_by function to handle profiles
CREATE OR REPLACE FUNCTION check_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure created_by matches authenticated user's profile
  IF NEW.created_by != auth.uid() THEN
    RAISE EXCEPTION 'created_by must match the authenticated user''s profile';
  END IF;

  -- Ensure user has a profile
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.created_by
  ) THEN
    RAISE EXCEPTION 'user must have a profile';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
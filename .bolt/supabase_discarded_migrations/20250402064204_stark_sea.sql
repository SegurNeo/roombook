/*
  # Create assets table

  1. New Tables
    - `assets`
      - `id` (uuid, primary key)
      - `created_at` (timestamp with timezone)
      - `address` (jsonb) - Stores full address details
      - `reference` (text, optional) - Public reference number
      - `rooms` (jsonb) - Array of room details
      - `bathrooms` (integer) - Number of bathrooms
      - `photos` (text[]) - Array of photo URLs
      - `purchase_price` (numeric, optional)
      - `purchase_date` (date, optional)
      - `management_model` (text, optional)
      - `monthly_rent` (numeric, optional)
      - `management_percentage` (numeric, optional)
      - `amenities` (text[]) - Array of amenity names
      - `user_id` (uuid) - References auth.users
      - `status` (text) - Asset status (active, inactive, maintenance)
      - `occupancy_rate` (numeric) - Current occupancy rate
      - `revenue` (numeric) - Total revenue generated
      - `avg_stay` (numeric) - Average stay duration
      - `total_bookings` (integer) - Total number of bookings

  2. Security
    - Enable RLS on `assets` table
    - Add policies for authenticated users to:
      - Read their own assets
      - Create new assets
      - Update their own assets
      - Delete their own assets
*/

-- Create assets table
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  address jsonb NOT NULL,
  reference text,
  rooms jsonb NOT NULL,
  bathrooms integer NOT NULL,
  photos text[] NOT NULL,
  purchase_price numeric,
  purchase_date date,
  management_model text,
  monthly_rent numeric,
  management_percentage numeric,
  amenities text[] NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  occupancy_rate numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  avg_stay numeric DEFAULT 0,
  total_bookings integer DEFAULT 0,
  CONSTRAINT valid_management_percentage CHECK (management_percentage IS NULL OR (management_percentage >= 0 AND management_percentage <= 100)),
  CONSTRAINT valid_occupancy_rate CHECK (occupancy_rate >= 0 AND occupancy_rate <= 100)
);

-- Enable Row Level Security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own assets"
  ON assets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create assets"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
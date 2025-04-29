/*
  # Add room status functionality

  1. New Function
    - `get_room_status`: Calculates room status based on bookings
      - Returns: 'available', 'booked', or 'expiring'
      - Considers current date, booking dates, and notice periods

  2. Security
    - Create secure view that inherits RLS from underlying tables
    - Function is SECURITY DEFINER to ensure proper access
*/

-- Create function to get room status
CREATE OR REPLACE FUNCTION get_room_status(room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_booking RECORD;
BEGIN
  -- Get the current active booking for the room
  SELECT 
    b.*,
    b.end_date - (b.notice_period_months * INTERVAL '1 month') as notice_start_date
  INTO current_booking
  FROM bookings b
  WHERE b.room_id = room_id
    AND b.status = 'active'
    AND b.start_date <= CURRENT_DATE
    AND b.end_date >= CURRENT_DATE
  ORDER BY b.start_date DESC
  LIMIT 1;

  -- Return status based on booking
  IF current_booking IS NULL THEN
    RETURN 'available';
  ELSIF CURRENT_DATE >= current_booking.notice_start_date THEN
    RETURN 'expiring';
  ELSE
    RETURN 'booked';
  END IF;
END;
$$;

-- Create a secure view that inherits RLS from rooms and assets tables
CREATE OR REPLACE VIEW room_status AS
SELECT 
  r.id as room_id,
  r.name as room_name,
  r.asset_id,
  get_room_status(r.id) as status
FROM rooms r
WHERE EXISTS (
  SELECT 1 
  FROM assets a
  JOIN profiles p ON p.organization_id = a.organization_id
  WHERE p.id = auth.uid()
  AND a.id = r.asset_id
);

-- Grant access to authenticated users
GRANT SELECT ON room_status TO authenticated;
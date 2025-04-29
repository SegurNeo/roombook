/*
  # Fix default amenities creation

  1. Changes
    - Update add_default_amenities function to handle errors properly
    - Add better error handling and logging
    - Ensure proper permission checks
    - Add transaction management

  2. Security
    - Maintain RLS policies
    - Ensure proper access control
    - Handle edge cases safely
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_organization_created ON organizations;
DROP FUNCTION IF EXISTS add_default_amenities();

-- Create improved function to add default amenities
CREATE OR REPLACE FUNCTION add_default_amenities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_amenities jsonb;
  amenity jsonb;
BEGIN
  -- Define default amenities as JSONB array
  default_amenities := jsonb_build_array(
    jsonb_build_object(
      'name', 'WiFi',
      'description', 'High-speed wireless internet access throughout the property'
    ),
    jsonb_build_object(
      'name', 'Air Conditioning',
      'description', 'Modern climate control system providing efficient cooling'
    ),
    jsonb_build_object(
      'name', 'Heating',
      'description', 'Central heating system for year-round comfort'
    ),
    jsonb_build_object(
      'name', 'Dishwasher',
      'description', 'Built-in energy-efficient dishwasher'
    ),
    jsonb_build_object(
      'name', 'Washing Machine',
      'description', 'In-unit washing machine for convenience'
    ),
    jsonb_build_object(
      'name', 'Parking',
      'description', 'Dedicated parking space'
    ),
    jsonb_build_object(
      'name', 'Security System',
      'description', '24/7 security monitoring and access control'
    )
  );

  -- Start a subtransaction
  BEGIN
    -- Insert each default amenity
    FOR amenity IN SELECT * FROM jsonb_array_elements(default_amenities)
    LOOP
      INSERT INTO amenities (
        name,
        description,
        organization_id,
        created_by
      ) VALUES (
        amenity->>'name',
        amenity->>'description',
        NEW.id,
        NEW.created_by
      );
    END LOOP;

    -- Log successful creation
    RAISE NOTICE 'Successfully added default amenities for organization %', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Ignore duplicate amenities
      RAISE NOTICE 'Some amenities already exist for organization %', NEW.id;
    WHEN OTHERS THEN
      -- Log other errors but don't fail the organization creation
      RAISE WARNING 'Error adding default amenities for organization %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Create trigger to add default amenities when organization is created
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_default_amenities();

-- Ensure RLS is enabled and policies are correct
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

-- Recreate policies with proper checks
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view amenities in their organization" ON amenities;
  DROP POLICY IF EXISTS "Users can create amenities in their organization" ON amenities;
  DROP POLICY IF EXISTS "Users can update amenities in their organization" ON amenities;
  DROP POLICY IF EXISTS "Users can delete amenities in their organization" ON amenities;

  -- Create new policies
  CREATE POLICY "Users can view amenities in their organization"
    ON amenities
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
    ON amenities
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
    ON amenities
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
    ON amenities
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
END $$;
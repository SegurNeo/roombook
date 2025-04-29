/*
  # Add Default Amenities Function

  1. Changes
    - Create function to add default amenities
    - Add trigger to automatically add amenities on organization creation
    - Include descriptions for each default amenity

  2. Security
    - Function is SECURITY DEFINER
    - Proper error handling
    - Maintains RLS policies
*/

-- Create function to add default amenities
CREATE OR REPLACE FUNCTION add_default_amenities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default amenities
  INSERT INTO amenities (
    name,
    description,
    organization_id,
    created_by
  ) VALUES 
    (
      'WiFi',
      'High-speed wireless internet access throughout the property',
      NEW.id,
      NEW.created_by
    ),
    (
      'Air Conditioning',
      'Modern climate control system providing efficient cooling for optimal comfort',
      NEW.id,
      NEW.created_by
    ),
    (
      'Heating',
      'Central heating system ensuring warmth during colder months',
      NEW.id,
      NEW.created_by
    ),
    (
      'Dishwasher',
      'Built-in energy-efficient dishwasher for convenient kitchen cleanup',
      NEW.id,
      NEW.created_by
    ),
    (
      'Washing Machine',
      'In-unit washing machine for laundry convenience',
      NEW.id,
      NEW.created_by
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details
    RAISE NOTICE 'Error adding default amenities: %', SQLERRM;
    -- Continue with organization creation even if amenities fail
    RETURN NEW;
END;
$$;

-- Create trigger to add default amenities when organization is created
DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_default_amenities();
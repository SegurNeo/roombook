/*
  # Add default amenities function

  1. Changes
    - Create function to add default amenities for new organizations
    - Add trigger to automatically add default amenities on organization creation
    - Include WiFi, AC, heating, dishwasher, and washing machine as defaults

  2. Security
    - Function runs with SECURITY DEFINER
    - Maintains RLS policies
    - Preserves organization context
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
      'High-speed wireless internet access',
      NEW.id,
      NEW.created_by
    ),
    (
      'Air Conditioning',
      'Climate control system for cooling',
      NEW.id,
      NEW.created_by
    ),
    (
      'Heating',
      'Climate control system for heating',
      NEW.id,
      NEW.created_by
    ),
    (
      'Dishwasher',
      'Built-in automatic dishwasher',
      NEW.id,
      NEW.created_by
    ),
    (
      'Washing Machine',
      'In-unit washing machine',
      NEW.id,
      NEW.created_by
    );

  RETURN NEW;
END;
$$;

-- Create trigger to add default amenities when organization is created
DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_default_amenities();
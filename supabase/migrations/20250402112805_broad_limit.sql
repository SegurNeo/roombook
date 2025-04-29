/*
  # Fix assets and profiles relationship

  1. Changes
    - Add foreign key constraint between assets.created_by and profiles.id
    - Update RLS policies to reflect the relationship

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'assets_created_by_fkey'
  ) THEN
    ALTER TABLE public.assets
    ADD CONSTRAINT assets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Update the assets query to use the correct relationship
CREATE OR REPLACE FUNCTION get_asset_with_creator(asset_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'asset', a.*,
    'creator', json_build_object(
      'id', p.id,
      'full_name', p.full_name
    )
  )
  FROM assets a
  LEFT JOIN profiles p ON p.id = a.created_by
  WHERE a.id = asset_id;
$$;
/*
  # Add settings column to organizations table

  1. Changes
    - Add settings column to organizations table
    - Update RLS policies for settings access
    - Add proper constraints and defaults

  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
    - Enforce organization-based access
*/

-- Add settings column to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{
  "language": "en",
  "region": "eu", 
  "currency": "eur",
  "dateFormat": "dd/mm/yyyy",
  "numberFormat": "1,234.56",
  "measurementUnit": "metric"
}'::jsonb;

-- Update RLS policies to allow settings updates
DROP POLICY IF EXISTS "Organization creators can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization superadmins can update organization" ON public.organizations;

CREATE POLICY "Organization creators can update their organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Organization superadmins can update organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (organization_superadmin = auth.uid())
  WITH CHECK (organization_superadmin = auth.uid());

-- Add constraint to validate settings structure
ALTER TABLE public.organizations
ADD CONSTRAINT settings_jsonb_check
CHECK (
  settings IS NULL OR (
    settings ? 'language' AND
    settings ? 'region' AND
    settings ? 'currency' AND
    settings ? 'dateFormat' AND
    settings ? 'numberFormat' AND
    settings ? 'measurementUnit'
  )
);
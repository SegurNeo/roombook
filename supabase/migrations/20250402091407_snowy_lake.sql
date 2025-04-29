-- Function to handle organization creation and profile update
CREATE OR REPLACE FUNCTION create_organization_and_update_profile(
  org_name text,
  org_role text,
  org_team_size text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create new organization
  INSERT INTO public.organizations (name, type, team_size, created_by)
  VALUES (org_name, org_role, org_team_size, auth.uid())
  RETURNING id INTO new_org_id;

  -- Update user's profile
  UPDATE public.profiles
  SET organization_id = new_org_id,
      onboarding_completed = true
  WHERE id = auth.uid();

  RETURN new_org_id;
END;
$$;
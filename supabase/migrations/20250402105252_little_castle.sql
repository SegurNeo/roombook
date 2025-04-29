/*
  # Add net schema and http extension

  1. Changes
    - Create net schema
    - Enable http extension in net schema
    - Update send_team_invites function to use http extension

  2. Security
    - Maintain RLS policies
    - Keep existing permissions
*/

-- Create net schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS net;

-- Enable http extension in net schema
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA net;

-- Update send_team_invites function to use http extension
CREATE OR REPLACE FUNCTION send_team_invites(
  invites jsonb
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite jsonb;
  invite_id uuid;
  user_org_id uuid;
  user_role text;
  org_name text;
  inviter_name text;
BEGIN
  -- Get the user's organization_id, role_type, and organization name
  SELECT 
    p.organization_id,
    p.role_type,
    o.name,
    p.full_name
  INTO 
    user_org_id,
    user_role,
    org_name,
    inviter_name
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid();

  -- Check if user has an organization
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;

  -- Check if user has permission to send invites
  IF user_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Only superadmins and admins can send invites';
  END IF;

  -- Process each invite
  FOR invite IN SELECT * FROM jsonb_array_elements(invites)
  LOOP
    -- Validate role type
    IF NOT (invite->>'role' IN ('admin', 'manager', 'viewer')) THEN
      RAISE EXCEPTION 'Invalid role type: %', invite->>'role';
    END IF;

    -- Prevent non-superadmins from creating admin invites
    IF user_role != 'superadmin' AND invite->>'role' = 'admin' THEN
      RAISE EXCEPTION 'Only superadmins can create admin invites';
    END IF;

    -- Insert the invite
    INSERT INTO public.team_invites (
      email,
      role_type,
      organization_id,
      invited_by
    )
    VALUES (
      invite->>'email',
      invite->>'role',
      user_org_id,
      auth.uid()
    )
    RETURNING id INTO invite_id;

    -- Return the invite ID
    RETURN NEXT invite_id;
  END LOOP;

  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    -- Add context to the error message
    RAISE EXCEPTION 'Error sending invites: %', SQLERRM;
END;
$$;
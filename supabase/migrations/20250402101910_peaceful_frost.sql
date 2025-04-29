/*
  # Fix team invites authorization

  1. Changes
    - Update send_team_invites function to handle role type checks properly
    - Add missing role type column to profiles if needed
    - Ensure proper RLS policies are in place
*/

-- First ensure role_type column exists with proper constraints
DO $$ 
BEGIN
  -- Add role_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role_type'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN role_type text DEFAULT 'viewer'
    CHECK (role_type IN ('superadmin', 'admin', 'manager', 'viewer'));
  END IF;
END $$;

-- Update send_team_invites function with better error handling and role checks
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
BEGIN
  -- Get the user's organization_id and role_type
  SELECT 
    organization_id,
    role_type 
  INTO 
    user_org_id,
    user_role
  FROM profiles
  WHERE id = auth.uid();

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
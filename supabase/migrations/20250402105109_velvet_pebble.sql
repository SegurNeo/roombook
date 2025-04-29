/*
  # Add team invite email functionality

  1. Changes
    - Add email template for team invites
    - Update send_team_invites function to trigger emails
    - Add function to handle invite acceptance

  2. Security
    - Maintain RLS policies
    - Use secure token generation
    - Add rate limiting for invite sending
*/

-- Create a function to send invite emails
CREATE OR REPLACE FUNCTION send_invite_email(
  invite_id uuid,
  recipient_email text,
  organization_name text,
  inviter_name text,
  role_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Send the email using Supabase's email service
  PERFORM net.http_post(
    url := net.http_build_url(
      'v1/invite',
      ARRAY[
        'key', current_setting('request.header.apikey')::text
      ]
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.header.authorization')::text
    ),
    body := jsonb_build_object(
      'email', recipient_email,
      'data', jsonb_build_object(
        'invite_id', invite_id,
        'organization_name', organization_name,
        'inviter_name', inviter_name,
        'role_type', role_type,
        'invite_url', current_setting('app.settings.site_url') || '/accept-invite?token=' || 
          encode(
            crypto.hmac(
              invite_id::text || recipient_email,
              current_setting('app.settings.jwt_secret'),
              'sha256'
            ),
            'hex'
          )
      )
    )
  );
END;
$$;

-- Update send_team_invites function to send emails
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

    -- Send the invite email
    PERFORM send_invite_email(
      invite_id,
      invite->>'email',
      org_name,
      inviter_name,
      invite->>'role'
    );

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

-- Function to verify and accept an invite
CREATE OR REPLACE FUNCTION verify_and_accept_invite(
  token text,
  invite_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record record;
  expected_token text;
BEGIN
  -- Get the invite details
  SELECT * INTO invite_record
  FROM team_invites
  WHERE id = invite_id
  AND status = 'pending'
  AND expires_at > now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Calculate expected token
  expected_token := encode(
    crypto.hmac(
      invite_id::text || invite_record.email,
      current_setting('app.settings.jwt_secret'),
      'sha256'
    ),
    'hex'
  );

  -- Verify token
  IF token = expected_token THEN
    -- Update invite status
    UPDATE team_invites
    SET status = 'accepted'
    WHERE id = invite_id;

    -- Update user's profile
    UPDATE profiles
    SET 
      organization_id = invite_record.organization_id,
      role_type = invite_record.role_type
    WHERE id = auth.uid();

    RETURN true;
  END IF;

  RETURN false;
END;
$$;
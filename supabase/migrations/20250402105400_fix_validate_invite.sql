/*
  # Fix validate_team_invite function

  1. Changes
    - Create validate_team_invite function with proper parameter type
    - Return proper validation response
*/

-- Drop existing validate_team_invite functions if they exist
DROP FUNCTION IF EXISTS public.validate_team_invite(text);
DROP FUNCTION IF EXISTS public.validate_team_invite(uuid);

-- Create the validate_team_invite function with text parameter
CREATE OR REPLACE FUNCTION public.validate_team_invite(
  invite_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record record;
  validation_result jsonb;
BEGIN
  -- Try to decode the token to get invite_id and email
  BEGIN
    -- Get the invite details from the token
    WITH token_parts AS (
      SELECT 
        split_part(invite_token, ':', 1) as invite_id,
        split_part(invite_token, ':', 2) as token_hash
    )
    SELECT i.* INTO invite_record
    FROM team_invites i, token_parts
    WHERE i.id::text = token_parts.invite_id
    AND i.status = 'pending'
    AND i.expires_at > now();

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'INVALID_TOKEN',
        'message', 'Invalid or expired invitation token'
      );
    END IF;

    -- Verify the token hash
    IF encode(
      crypto.hmac(
        invite_record.id::text || invite_record.email,
        current_setting('app.settings.jwt_secret'),
        'sha256'
      ),
      'hex'
    ) != token_parts.token_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'INVALID_TOKEN',
        'message', 'Invalid invitation token'
      );
    END IF;

    -- Token is valid, return invite details
    RETURN jsonb_build_object(
      'valid', true,
      'invite', jsonb_build_object(
        'id', invite_record.id,
        'email', invite_record.email,
        'role_type', invite_record.role_type,
        'organization_id', invite_record.organization_id,
        'expires_at', invite_record.expires_at
      )
    );

  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'INVALID_TOKEN',
        'message', 'Invalid invitation token format'
      );
  END;
END;
$$; 
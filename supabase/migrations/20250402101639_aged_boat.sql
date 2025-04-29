/*
  # Add team invites functionality

  1. New Tables
    - `team_invites`
      - `id` (uuid, primary key)
      - `email` (text, recipient email)
      - `role_type` (text, role for the invited user)
      - `organization_id` (uuid, reference to organizations)
      - `invited_by` (uuid, reference to users)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `status` (text, invite status)

  2. Security
    - Enable RLS on team_invites table
    - Add policies for invite management
    - Only allow organization members to create invites
*/

-- Create team_invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_type text NOT NULL CHECK (role_type IN ('admin', 'manager', 'viewer')),
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  UNIQUE(email, organization_id, status)
);

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Organization members can create invites"
  ON public.team_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = team_invites.organization_id
      AND profiles.role_type IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Organization members can view invites"
  ON public.team_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = team_invites.organization_id
    )
  );

-- Function to send team invites
CREATE OR REPLACE FUNCTION send_team_invites(
  invites jsonb
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite jsonb;
  invite_id uuid;
  user_org_id uuid;
BEGIN
  -- Get the user's organization_id
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = auth.uid();

  -- Check if user has permission to send invites
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND organization_id = user_org_id
    AND role_type IN ('superadmin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized to send invites';
  END IF;

  -- Process each invite
  FOR invite IN SELECT * FROM jsonb_array_elements(invites)
  LOOP
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
END;
$$;
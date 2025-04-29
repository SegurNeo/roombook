/// <reference types="npm:@supabase/functions-js/edge-runtime.d.ts" />
import { Resend } from 'npm:resend@2.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamInvite {
  id: string;
  email: string;
  role_type: string;
  organization_id: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get pending invites
    const { data: invites, error: invitesError } = await supabase
      .from('team_invites')
      .select(`
        *,
        organizations (name),
        profiles!team_invites_invited_by_fkey (full_name)
      `)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (invitesError) {
      throw invitesError;
    }

    if (!invites || invites.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending invites found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Send emails for each invite
    const emailPromises = invites.map(async (invite: any) => {
      const inviteUrl = `${Deno.env.get('SITE_URL')}/accept-invite?token=${invite.id}`;
      
      try {
        await resend.emails.send({
          from: 'PropertyHub <noreply@propertyhub.com>',
          to: invite.email,
          subject: `You've been invited to join ${invite.organizations.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been invited to join ${invite.organizations.name}</h2>
              
              <p>Hello,</p>
              
              <p>${invite.profiles.full_name} has invited you to join ${invite.organizations.name} 
              as a ${invite.role_type}.</p>
              
              <p style="margin: 2em 0;">
                <a href="${inviteUrl}" 
                   style="background: #000; color: #fff; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px;">
                  Accept Invitation
                </a>
              </p>
              
              <p style="color: #666; font-size: 0.9em;">
                This invite will expire in 7 days. If you don't want to accept this invitation, 
                you can ignore this email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 2em 0;">
              
              <p style="color: #666; font-size: 0.8em;">
                If you're having trouble with the button above, copy and paste this URL into your browser:
                <br>
                ${inviteUrl}
              </p>
            </div>
          `,
        });

        // Update invite status to 'sent'
        await supabase
          .from('team_invites')
          .update({ status: 'sent' })
          .eq('id', invite.id);

        return {
          invite_id: invite.id,
          email: invite.email,
          status: 'sent',
        };
      } catch (error) {
        console.error(`Failed to send email to ${invite.email}:`, error);
        return {
          invite_id: invite.id,
          email: invite.email,
          status: 'failed',
          error: error.message,
        };
      }
    });

    const results = await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({
        message: 'Invites processed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
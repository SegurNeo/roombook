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

    // Process invites sequentially to avoid rate limits
    const results: any[] = [];
    for (const invite of invites) {
      // Ensure SITE_URL doesn't have a trailing slash
      const siteUrlBase = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, ''); 
      const inviteUrl = `${siteUrlBase}/accept-invite?token=${invite.id}`;
      
      let emailSent = false;
      let statusUpdateError: any = null;

      try {
        // Step 1: Try sending email
        await resend.emails.send({
          from: 'PropertyHub <dev@segurneo.com>',
          to: invite.email,
          subject: `You've been invited to join ${invite.organizations.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been invited to join ${invite.organizations.name}</h2>
              
              <p>Hello,</p>
              
              <p>${(invite.profiles as any)?.full_name || 'Someone'} has invited you to join ${invite.organizations.name} 
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
        emailSent = true;

        // Step 2: Try updating status if email sent
        console.log(`Attempting to update status for invite ID: ${invite.id}`);
        const { data: updateData, error: updateError } = await supabase
          .from('team_invites')
          .update({ status: 'sent' })
          .eq('id', invite.id)
          .select();

        console.log('Update result:', { updateData, updateError });

        if (updateError) {
          console.log('Update error detected. Throwing error...');
          statusUpdateError = updateError;
          throw updateError; // Throw to be caught by the outer catch
        } else {
            console.log('No update error detected. Proceeding...');
        }

        // Both successful
        results.push({
          invite_id: invite.id,
          email: invite.email,
          status: 'sent',
        });

      } catch (error) {
        if (emailSent && statusUpdateError) {
          // Error happened during status update after successful send
          console.error(`Email sent to ${invite.email}, but failed to update status:`, statusUpdateError);
          results.push({
            invite_id: invite.id,
            email: invite.email,
            status: 'send_error_update_failed', // More specific status
            error: statusUpdateError.message,
          });
        } else {
          // Error happened during email sending (or other unexpected error)
          console.error(`Failed to process invite for ${invite.email}:`, error);
          results.push({
            invite_id: invite.id,
            email: invite.email,
            status: 'failed', 
            error: error.message,
          });
        }
      }
    }

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
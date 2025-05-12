// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Hello from Functions!")

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace with your frontend URL in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Ensure the request is a POST request
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // --- Get Supabase Admin Client ---
    // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your secrets
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- Parse Request Body ---
    const payload = await req.json();
    const { booking_id } = payload;

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'Missing booking_id in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Attempting to mark booking ${booking_id} as paid_manual.`);

    // --- Update Booking Status in Database ---
    const { data, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ payment_status: 'paid_manual' })
      .eq('id', booking_id)
      .select() // Optionally select the updated record to confirm
      .single(); // Expect a single record to be updated

    if (updateError) {
      console.error(`Error updating booking ${booking_id}:`, updateError);
      if (updateError.code === 'PGRST116') { // PostgREST error for "No rows found"
        return new Response(JSON.stringify({ error: `Booking with ID ${booking_id} not found.` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw updateError; // Rethrow other errors
    }

    if (!data) {
      // This case should ideally be caught by PGRST116, but as a fallback
      console.warn(`Booking ${booking_id} not found after update attempt, though no explicit error was thrown.`);
      return new Response(JSON.stringify({ error: `Booking with ID ${booking_id} not found or not updated.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Booking ${booking_id} successfully marked as paid_manual.`);

    // --- Return Success Response ---
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Booking ${booking_id} marked as paid_manual.`,
      updated_booking: data // Return the updated booking data
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mark-booking-paid-manual function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/mark-booking-paid-manual' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { supabase_customer_id, success_url, cancel_url } = await req.json();

    if (!supabase_customer_id) {
      return new Response(JSON.stringify({ error: "Missing supabase_customer_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating SEPA setup session for Supabase customer: ${supabase_customer_id}`);

    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', supabase_customer_id)
      .single();

    if (fetchError || !customer || !customer.stripe_customer_id) {
      console.error("Error fetching customer or missing Stripe ID:", fetchError);
      return new Response(JSON.stringify({ error: "Customer not found or not synced with Stripe" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeCustomerId = customer.stripe_customer_id;
    console.log(`Found Stripe customer ID: ${stripeCustomerId}`);

    // Use provided URLs or fallback to default ones
    const defaultSuccessUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/customers?setup_success=true`;
    const defaultCancelUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/customers`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['sepa_debit'],
      mode: 'setup',
      currency: 'eur',
      customer: stripeCustomerId,
      success_url: success_url || defaultSuccessUrl,
      cancel_url: cancel_url || defaultCancelUrl,
      metadata: {
        supabase_customer_id: supabase_customer_id,
      },
      setup_intent_data: {
        metadata: {
          supabase_customer_id: supabase_customer_id,
        }
      }
    });

    console.log(`Stripe Checkout Session created: ${session.id}`);

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating SEPA setup session:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}); 
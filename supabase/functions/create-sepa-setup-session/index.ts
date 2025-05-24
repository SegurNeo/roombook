// @ts-ignore - Deno imports not recognized locally
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports not recognized locally
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Deno imports not recognized locally
import Stripe from "https://esm.sh/stripe@11.1.0";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore - Deno global not recognized locally
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  // @ts-ignore - Deno global not recognized locally
  Deno.env.get("SUPABASE_URL") ?? "",
  // @ts-ignore - Deno global not recognized locally
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Helper function to ensure URL has https protocol
function ensureHttpsProtocol(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

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
    const requestBody = await req.json();
    console.log("Received request body:", JSON.stringify(requestBody, null, 2));
    
    const { supabase_customer_id, success_url, cancel_url } = requestBody;
    console.log("Extracted values:", { supabase_customer_id, success_url, cancel_url });

    if (!supabase_customer_id) {
      console.error("Missing supabase_customer_id in request:", requestBody);
      return new Response(JSON.stringify({ error: "Missing supabase_customer_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating SEPA setup session for Supabase customer: ${supabase_customer_id}`);

    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('stripe_customer_id, first_name, last_name')
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

    // Log existing payment methods for this customer
    try {
      const existingPaymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'sepa_debit',
      });

      console.log(`Customer ${customer.first_name} ${customer.last_name} has ${existingPaymentMethods.data.length} existing SEPA payment methods`);

      // Note: Stripe naturally prevents duplicate payment methods with the same IBAN
      // If a customer tries to add the same bank account, Stripe will return the existing Payment Method ID

    } catch (stripeError) {
      console.error("Error checking existing payment methods:", stripeError);
      // Continue with setup - don't block for Stripe API errors
    }

    // Use provided URLs or fallback to default ones with proper protocol
    // @ts-ignore - Deno global not recognized locally
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173';
    const defaultSuccessUrl = `${ensureHttpsProtocol(siteUrl)}/customers?setup_success=true`;
    const defaultCancelUrl = `${ensureHttpsProtocol(siteUrl)}/customers`;

    const finalSuccessUrl = success_url ? ensureHttpsProtocol(success_url) : defaultSuccessUrl;
    const finalCancelUrl = cancel_url ? ensureHttpsProtocol(cancel_url) : defaultCancelUrl;

    console.log(`Creating Stripe session with URLs - Success: ${finalSuccessUrl}, Cancel: ${finalCancelUrl}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['sepa_debit'],
      mode: 'setup',
      currency: 'eur',
      customer: stripeCustomerId,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
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
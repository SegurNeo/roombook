import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use the version recommended in Supabase docs for Stripe webhooks
import Stripe from "https://esm.sh/stripe@14?target=denonext";

// Define CORS headers (though less critical for webhooks, good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST', // Webhooks are typically POST
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16", // Keep your API version unless specific reason to change
  httpClient: Stripe.createFetchHttpClient(),
});

// Use Admin client to update DB
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Get the webhook signing secret from environment variables
// IMPORTANT: User needs to set this after creating the endpoint in Stripe dashboard!
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {

  if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text(); // Read body as text for signature verification

  if (!signature) {
    console.error("Webhook error: Missing stripe-signature header.");
    return new Response("Missing signature", { status: 400 });
  }

  if (!webhookSecret) {
      console.error("Webhook error: STRIPE_WEBHOOK_SECRET is not set in environment variables.");
      return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  // Use the crypto provider as recommended in Supabase docs
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  try {
    // Verify the webhook signature
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined, // Tolerance (optional)
      cryptoProvider // Required for Deno
    );
    console.log(`Webhook received: ${event.type}, ID: ${event.id}`);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    // Check if the error is the specific crypto one
    if (err.message?.includes('crypto.timingSafeEqual is not implemented')) {
        console.error("FATAL: Web Crypto API issue in Supabase runtime environment.");
        // Return a specific error message for this case
        return new Response("Internal server error: Crypto implementation issue.", { status: 500 });
    }
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // --- Handle Specific Events ---

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'setup' && session.setup_intent) {
          const setupIntentId = session.setup_intent as string;
          console.log(`Processing checkout.session.completed (setup mode) for SetupIntent: ${setupIntentId}`);
          const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
            expand: ['payment_method', 'mandate'],
          });
          const supabaseCustomerId = session.metadata?.supabase_customer_id;
          const paymentMethodId = (setupIntent.payment_method as Stripe.PaymentMethod)?.id;
          const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'unknown';
          if (supabaseCustomerId && paymentMethodId) {
            console.log(`Updating Supabase customer ${supabaseCustomerId}: PM=${paymentMethodId}, Mandate=${mandateStatus}`);
            const { error: updateError } = await supabaseAdmin
              .from('customers')
              .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
              .eq('id', supabaseCustomerId);
            if (updateError) {
              console.error(`Failed to update customer ${supabaseCustomerId}:`, updateError);
            } else {
              console.log(`Successfully updated customer ${supabaseCustomerId}.`);
            }
          } else {
            console.warn("Missing data in checkout.session.completed (setup):", { supabaseCustomerId, paymentMethodId, setupIntentId });
          }
        } else {
          console.log(`Ignoring checkout.session.completed (mode: ${session.mode})`);
        }
        break;
      }
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const supabaseCustomerId = setupIntent.metadata?.supabase_customer_id;
        const paymentMethodId = setupIntent.payment_method as string;
        const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'active';
         if (supabaseCustomerId && paymentMethodId) {
            console.log(`Processing setup_intent.succeeded for ${supabaseCustomerId}: PM=${paymentMethodId}, Mandate=${mandateStatus}`);
            const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
                .eq('id', supabaseCustomerId)
                .is('stripe_payment_method_id', null); // Only update if not already set
            if (error) console.error('DB update error on setup_intent.succeeded:', error);
            else console.log(`Customer ${supabaseCustomerId} updated via setup_intent.succeeded.`);
         }
        break;
      }
      case 'setup_intent.setup_failed': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const supabaseCustomerId = setupIntent.metadata?.supabase_customer_id;
        const failureReason = setupIntent.last_setup_error?.message || 'Unknown reason';
        if (supabaseCustomerId) {
            console.log(`Processing setup_intent.setup_failed for ${supabaseCustomerId}: ${failureReason}`);
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: 'failed' })
                .eq('id', supabaseCustomerId);
             if (error) console.error('DB update error on setup_intent.setup_failed:', error);
             else console.log(`Customer ${supabaseCustomerId} mandate status set to failed.`);
        }
        break;
      }
       case 'mandate.updated': {
        const mandate = event.data.object as Stripe.Mandate;
        const paymentMethodId = mandate.payment_method as string;
        if (paymentMethodId) {
            console.log(`Processing mandate.updated for PM ${paymentMethodId}: Status=${mandate.status}`);
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: mandate.status })
                .eq('stripe_payment_method_id', paymentMethodId);
            if (error) console.error('DB update error on mandate.updated:', error);
            else console.log(`Customer mandate status updated via mandate.updated for PM ${paymentMethodId}.`);
        }
        break;
       }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
     console.error("Error processing webhook event:", error);
     return new Response(`Webhook Handler Error: ${error.message}`, { status: 500 });
  }
});

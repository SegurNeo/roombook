import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
          // Default to 'unknown' if mandate or mandate.status is null/undefined
          const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'unknown'; 
          
          if (supabaseCustomerId && paymentMethodId) {
            console.log(`Updating Supabase customer ${supabaseCustomerId}: PM=${paymentMethodId}, Mandate=${mandateStatus}`);
            const { error: updateError } = await supabaseAdmin
              .from('customers')
              .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
              .eq('id', supabaseCustomerId);
            if (updateError) {
              console.error(`Failed to update customer ${supabaseCustomerId} on checkout.session.completed:`, updateError);
            } else {
              console.log(`Successfully updated customer ${supabaseCustomerId} via checkout.session.completed.`);
            }
          } else {
            console.warn("Missing data in checkout.session.completed (setup):", { supabaseCustomerId, paymentMethodId, setupIntentId });
          }
        } else {
          console.log(`Ignoring checkout.session.completed (mode: ${session.mode || 'N/A'})`);
        }
        break;
      }
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const supabaseCustomerId = setupIntent.metadata?.supabase_customer_id;
        const paymentMethodId = setupIntent.payment_method as string;
        // Default to 'active' if mandate or mandate.status is null/undefined, as succeeding a setup intent usually means mandate is active.
        const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'active';
         if (supabaseCustomerId && paymentMethodId) {
            console.log(`Processing setup_intent.succeeded for ${supabaseCustomerId}: PM=${paymentMethodId}, Mandate=${mandateStatus}`);
            // Consider if only updating if null is still desired, or if it should always update to the latest.
            // For now, keeping the original logic: .is('stripe_payment_method_id', null)
            const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
                .eq('id', supabaseCustomerId);
                //.is('stripe_payment_method_id', null); // Only update if not already set by checkout.session.completed
            if (error) console.error('DB update error on setup_intent.succeeded:', error);
            else console.log(`Customer ${supabaseCustomerId} updated via setup_intent.succeeded.`);
         } else {
            console.warn("Missing data in setup_intent.succeeded:", { supabaseCustomerId, paymentMethodId });
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
                .update({ stripe_mandate_status: 'failed' }) // Set a clear 'failed' status
                .eq('id', supabaseCustomerId);
             if (error) console.error('DB update error on setup_intent.setup_failed:', error);
             else console.log(`Customer ${supabaseCustomerId} mandate status set to failed.`);
        } else {
            console.warn("Missing supabase_customer_id in setup_intent.setup_failed metadata.");
        }
        break;
      }
       case 'mandate.updated': {
        const mandate = event.data.object as Stripe.Mandate;
        // A mandate is linked to a payment method. We find the customer via the payment method.
        const paymentMethodId = mandate.payment_method as string; 
        if (paymentMethodId) {
            console.log(`Processing mandate.updated for PM ${paymentMethodId}: Status=${mandate.status}`);
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: mandate.status })
                .eq('stripe_payment_method_id', paymentMethodId); // Find customer by their SEPA payment method ID
            if (error) console.error('DB update error on mandate.updated:', error);
            else console.log(`Customer mandate status updated via mandate.updated for PM ${paymentMethodId}.`);
        } else {
            console.warn("Missing payment_method ID in mandate.updated event.");
        }
        break;
       }
      // --- NEW: Handle PaymentIntent Succeeded ---
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const supabaseBookingId = paymentIntent.metadata?.supabase_booking_id;

        if (supabaseBookingId) {
          console.log(`Processing payment_intent.succeeded for booking_id: ${supabaseBookingId}`);
          const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({ payment_status: 'paid_stripe' })
            .eq('id', supabaseBookingId);

          if (updateError) {
            console.error(`Failed to update booking ${supabaseBookingId} to paid_stripe:`, updateError);
          } else {
            console.log(`Booking ${supabaseBookingId} successfully marked as paid_stripe.`);
          }
        } else {
          console.warn("payment_intent.succeeded received without supabase_booking_id in metadata. PI_ID:", paymentIntent.id);
        }
        break;
      }
      // --- NEW: Handle PaymentIntent Failed ---
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const supabaseBookingId = paymentIntent.metadata?.supabase_booking_id;
        const failureReason = paymentIntent.last_payment_error?.message || 'Unknown reason';

        if (supabaseBookingId) {
          console.log(`Processing payment_intent.payment_failed for booking_id: ${supabaseBookingId}. Reason: ${failureReason}`);
          const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({ 
              payment_status: 'failed_stripe' 
              // Optionally, add failureReason to a notes field if you have one:
              // notes: `Stripe payment failed: ${failureReason}` 
            })
            .eq('id', supabaseBookingId);

          if (updateError) {
            console.error(`Failed to update booking ${supabaseBookingId} to failed_stripe:`, updateError);
          } else {
            console.log(`Booking ${supabaseBookingId} successfully marked as failed_stripe.`);
          }
        } else {
          console.warn("payment_intent.payment_failed received without supabase_booking_id in metadata. PI_ID:", paymentIntent.id);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@11.1.0";

// Define CORS headers (though less critical for webhooks, good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST', // Webhooks are typically POST
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
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

  try {
    // Verify the webhook signature
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined, // Tolerance (optional)
      Stripe.createSubtleCryptoProvider() // Required for Deno
    );
    console.log(`Webhook received: ${event.type}, ID: ${event.id}`);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // --- Handle Specific Events ---

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Check if it's for a SEPA mandate setup
        if (session.mode === 'setup' && session.setup_intent) {
          const setupIntentId = session.setup_intent as string;
          console.log(`Processing checkout.session.completed (setup mode) for SetupIntent: ${setupIntentId}`);

          // Retrieve the SetupIntent to get mandate and payment method details
          // Expand 'payment_method' and 'mandate' for easier access
          const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
            expand: ['payment_method', 'mandate'],
          });

          const supabaseCustomerId = session.metadata?.supabase_customer_id;
          const paymentMethodId = (setupIntent.payment_method as Stripe.PaymentMethod)?.id;
          // Mandate status might be pending initially
          const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'unknown';

          if (supabaseCustomerId && paymentMethodId) {
            console.log(`Updating Supabase customer ${supabaseCustomerId}: PaymentMethod=${paymentMethodId}, MandateStatus=${mandateStatus}`);
            const { error: updateError } = await supabaseAdmin
              .from('customers')
              .update({
                stripe_payment_method_id: paymentMethodId,
                stripe_mandate_status: mandateStatus,
              })
              .eq('id', supabaseCustomerId);

            if (updateError) {
              console.error(`Failed to update customer ${supabaseCustomerId}:`, updateError);
              // Don't return 500 to Stripe here, just log it. Stripe doesn't need to retry for DB errors.
            } else {
              console.log(`Successfully updated customer ${supabaseCustomerId}.`);
            }
          } else {
            console.warn("Missing supabase_customer_id or payment_method_id in SetupIntent:", setupIntentId);
          }
        } else {
          console.log(`Ignoring checkout.session.completed (mode: ${session.mode})`);
        }
        break;
      }

      // Optional but Recommended: Handle direct SetupIntent updates
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const supabaseCustomerId = setupIntent.metadata?.supabase_customer_id;
        const paymentMethodId = setupIntent.payment_method as string;
        const mandateStatus = (setupIntent.mandate as Stripe.Mandate)?.status || 'active'; // Usually active on success

         if (supabaseCustomerId && paymentMethodId) {
            console.log(`Processing setup_intent.succeeded for ${supabaseCustomerId}: PaymentMethod=${paymentMethodId}, MandateStatus=${mandateStatus}`);
            const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
                .eq('id', supabaseCustomerId)
                .eq('stripe_payment_method_id', null); // Optional: only update if not already set by checkout event
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
                .update({ stripe_mandate_status: 'failed' }) // Mark mandate as failed
                .eq('id', supabaseCustomerId);
             if (error) console.error('DB update error on setup_intent.setup_failed:', error);
             else console.log(`Customer ${supabaseCustomerId} mandate status set to failed.`);
             // TODO: Consider notifying the user/admin about the failure
        }
        break;
      }

       // Optional: Handle mandate status changes directly
       case 'mandate.updated': {
        const mandate = event.data.object as Stripe.Mandate;
        const paymentMethodId = mandate.payment_method as string;

        if (paymentMethodId) {
            console.log(`Processing mandate.updated for PaymentMethod ${paymentMethodId}: Status=${mandate.status}`);
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: mandate.status })
                .eq('stripe_payment_method_id', paymentMethodId); // Find customer by payment method
            if (error) console.error('DB update error on mandate.updated:', error);
            else console.log(`Customer mandate status updated via mandate.updated.`);
        }
        break;
       }

      // TODO: Add handlers for payment_intent.succeeded and payment_intent.payment_failed later

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
     console.error("Error processing webhook event:", error);
     // Return 500 only for unexpected processing errors, not for failed updates etc.
     return new Response(`Webhook Handler Error: ${error.message}`, { status: 500 });
  }
}); 
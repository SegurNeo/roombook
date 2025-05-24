import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno imports not recognized locally
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports not recognized locally  
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Deno imports not recognized locally
import Stripe from "https://esm.sh/stripe@14.20.0?target=denonext";

// Define CORS headers (though less critical for webhooks, good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST', // Webhooks are typically POST
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
};

// @ts-ignore - Deno global not recognized locally
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16", // Keep your API version unless specific reason to change
  httpClient: Stripe.createFetchHttpClient(),
});

// Use Admin client to update DB
const supabaseAdmin = createClient(
  // @ts-ignore - Deno global not recognized locally
  Deno.env.get("SUPABASE_URL") ?? "",
  // @ts-ignore - Deno global not recognized locally
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Get the webhook signing secret from environment variables
// IMPORTANT: User needs to set this after creating the endpoint in Stripe dashboard!
// @ts-ignore - Deno global not recognized locally
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Helper function to update or insert payment method in customer_payment_methods table
async function upsertCustomerPaymentMethod(
  supabaseCustomerId: string, 
  paymentMethodId: string, 
  mandateStatus: string
) {
  try {
    // First, get payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const lastFour = paymentMethod.sepa_debit?.last4 || null;
    const paymentMethodType = paymentMethod.type || 'sepa_debit';

    // Check if this payment method already exists for this customer
    const { data: existingPM, error: checkError } = await supabaseAdmin
      .from('customer_payment_methods')
      .select('*')
      .eq('customer_id', supabaseCustomerId)
      .eq('stripe_payment_method_id', paymentMethodId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing payment method:', checkError);
      return { error: checkError };
    }

    if (existingPM) {
      // Update existing payment method
      const { error: updateError } = await supabaseAdmin
        .from('customer_payment_methods')
        .update({
          stripe_mandate_status: mandateStatus,
          last_four: lastFour,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPM.id);

      if (updateError) {
        console.error('Error updating existing payment method:', updateError);
        return { error: updateError };
      }

      console.log(`Updated existing payment method ${existingPM.id} for customer ${supabaseCustomerId}`);
      return { success: true, paymentMethodRecord: existingPM, isUpdate: true };
    } else {
      // Insert new payment method
      // First check if customer has any payment methods to determine if this should be default
      const { data: existingPMs, error: countError } = await supabaseAdmin
        .from('customer_payment_methods')
        .select('id, is_default')
        .eq('customer_id', supabaseCustomerId);

      if (countError) {
        console.error('Error checking existing payment methods count:', countError);
        return { error: countError };
      }

      const isFirstPaymentMethod = !existingPMs || existingPMs.length === 0;
      const shouldBeDefault = isFirstPaymentMethod || !existingPMs.some(pm => pm.is_default);

      // If this should be default, first unset any existing defaults
      if (shouldBeDefault && existingPMs && existingPMs.length > 0) {
        await supabaseAdmin
          .from('customer_payment_methods')
          .update({ is_default: false })
          .eq('customer_id', supabaseCustomerId)
          .eq('is_default', true);
      }

      const { data: newPM, error: insertError } = await supabaseAdmin
        .from('customer_payment_methods')
        .insert({
          customer_id: supabaseCustomerId,
          stripe_payment_method_id: paymentMethodId,
          stripe_mandate_status: mandateStatus,
          payment_method_type: paymentMethodType,
          is_default: shouldBeDefault,
          nickname: isFirstPaymentMethod ? 'Primary Payment Method' : `Payment Method ${(existingPMs?.length || 0) + 1}`,
          last_four: lastFour,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting new payment method:', insertError);
        return { error: insertError };
      }

      console.log(`Inserted new payment method ${newPM.id} for customer ${supabaseCustomerId}`);
      return { success: true, paymentMethodRecord: newPM };
    }
  } catch (error) {
    console.error('Error in upsertCustomerPaymentMethod:', error);
    return { error };
  }
}

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
            
            // Update legacy fields for backward compatibility
            const { error: updateError } = await supabaseAdmin
              .from('customers')
              .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
              .eq('id', supabaseCustomerId);
            
            if (updateError) {
              console.error(`Error updating customer ${supabaseCustomerId} legacy fields:`, updateError);
            } else {
              console.log(`Customer ${supabaseCustomerId} legacy fields updated by checkout.session.completed.`);
            }

            // Update/insert in new customer_payment_methods table
            const pmResult = await upsertCustomerPaymentMethod(supabaseCustomerId, paymentMethodId, mandateStatus);
            if (pmResult.error) {
              console.error(`Error managing payment method for customer ${supabaseCustomerId}:`, pmResult.error);
            } else {
              console.log(`Payment method successfully managed for customer ${supabaseCustomerId}`);
              
              // If this was an update of existing payment method, mark it for frontend notification
              if (pmResult.isUpdate) {
                await supabaseAdmin
                  .from('customers')
                  .update({ 
                    last_payment_method_action: 'updated_existing',
                    last_payment_method_action_at: new Date().toISOString()
                  })
                  .eq('id', supabaseCustomerId);
                console.log(`Marked customer ${supabaseCustomerId} for 'updated_existing' notification`);
              }
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
            
            // Update legacy fields for backward compatibility
            const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_payment_method_id: paymentMethodId, stripe_mandate_status: mandateStatus })
                .eq('id', supabaseCustomerId);
                
            if (error) {
              console.error('DB update error on setup_intent.succeeded (legacy):', error);
            } else {
              console.log(`Customer ${supabaseCustomerId} legacy fields updated via setup_intent.succeeded.`);
            }

            // Update/insert in new customer_payment_methods table
            const pmResult = await upsertCustomerPaymentMethod(supabaseCustomerId, paymentMethodId, mandateStatus);
            if (pmResult.error) {
              console.error(`Error managing payment method for customer ${supabaseCustomerId}:`, pmResult.error);
            } else {
              console.log(`Payment method successfully managed for customer ${supabaseCustomerId}`);
              
              // If this was an update of existing payment method, mark it for frontend notification
              if (pmResult.isUpdate) {
                await supabaseAdmin
                  .from('customers')
                  .update({ 
                    last_payment_method_action: 'updated_existing',
                    last_payment_method_action_at: new Date().toISOString()
                  })
                  .eq('id', supabaseCustomerId);
                console.log(`Marked customer ${supabaseCustomerId} for 'updated_existing' notification`);
              }
            }
         } else {
            console.warn("Missing data in setup_intent.succeeded:", { supabaseCustomerId, paymentMethodId });
         }
        break;
      }
      case 'setup_intent.setup_failed': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const supabaseCustomerId = setupIntent.metadata?.supabase_customer_id;
        const paymentMethodId = setupIntent.payment_method as string;
        const failureReason = setupIntent.last_setup_error?.message || 'Unknown reason';
        if (supabaseCustomerId) {
            console.log(`Processing setup_intent.setup_failed for ${supabaseCustomerId}: ${failureReason}`);
            
            // Update legacy fields
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: 'failed' })
                .eq('id', supabaseCustomerId);
                
             if (error) {
               console.error('DB update error on setup_intent.setup_failed (legacy):', error);
             } else {
               console.log(`Customer ${supabaseCustomerId} mandate status set to failed (legacy).`);
             }

            // Update payment method table if payment method exists
            if (paymentMethodId) {
              const { error: pmError } = await supabaseAdmin
                .from('customer_payment_methods')
                .update({ stripe_mandate_status: 'failed' })
                .eq('customer_id', supabaseCustomerId)
                .eq('stripe_payment_method_id', paymentMethodId);
                
              if (pmError) {
                console.error('Error updating payment method mandate status to failed:', pmError);
              } else {
                console.log(`Payment method ${paymentMethodId} mandate status set to failed.`);
              }
            }
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
            
            // Update legacy field
             const { error } = await supabaseAdmin
                .from('customers')
                .update({ stripe_mandate_status: mandate.status })
                .eq('stripe_payment_method_id', paymentMethodId);
                
            if (error) {
              console.error('DB update error on mandate.updated (legacy):', error);
            } else {
              console.log(`Customer mandate status updated via mandate.updated for PM ${paymentMethodId} (legacy).`);
            }

            // Update payment method table
            const { error: pmError } = await supabaseAdmin
              .from('customer_payment_methods')
              .update({ stripe_mandate_status: mandate.status })
              .eq('stripe_payment_method_id', paymentMethodId);
              
            if (pmError) {
              console.error('Error updating payment method mandate status:', pmError);
            } else {
              console.log(`Payment method ${paymentMethodId} mandate status updated via mandate.updated.`);
            }
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
      // --- Invoice Creation Webhook ---
      case 'invoice.created': {
        const invoice = event.data.object as Stripe.Invoice;
        const rentTransactionId = invoice.metadata?.rent_transaction_id;
        const stripePaymentIntentId = invoice.payment_intent as string | null; 

        if (rentTransactionId) {
          console.log(`Processing invoice.created for rent_transaction_id: ${rentTransactionId}. Invoice ID: ${invoice.id}`);
          
          const updatePayload: { status: string; stripe_payment_intent_id?: string } = {
            status: 'processing' // Or a more specific 'invoice_created' or 'invoice_pending_payment'
          };

          if (stripePaymentIntentId) {
            updatePayload.stripe_payment_intent_id = stripePaymentIntentId;
          }

          const { error: updateError } = await supabaseAdmin
            .from('rent_transactions')
            .update(updatePayload)
            .eq('id', rentTransactionId);

          if (updateError) {
            console.error(`Failed to update rent_transaction ${rentTransactionId} to 'processing' on invoice.created:`, updateError);
          } else {
            console.log(`Rent_transaction ${rentTransactionId} successfully marked as 'processing'. Invoice: ${invoice.id}, PI: ${stripePaymentIntentId || 'N/A'}`);
          }
        } else {
           console.warn(`invoice.created (Invoice ID: ${invoice.id}) received without rent_transaction_id in metadata.`);
        }
        break;
      }
      // --- Invoice Payment Webhooks (Modified) ---
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const rentTransactionId = invoice.metadata?.rent_transaction_id;
        const stripePaymentIntentId = invoice.payment_intent as string;

        if (rentTransactionId) {
          console.log(`Processing invoice.payment_succeeded for rent_transaction_id: ${rentTransactionId}`);
          const { error: updateError } = await supabaseAdmin
            .from('rent_transactions')
            .update({ 
              status: 'paid', 
              stripe_payment_intent_id: stripePaymentIntentId 
            })
            .eq('id', rentTransactionId);

          if (updateError) {
            console.error(`Failed to update rent_transaction ${rentTransactionId} to 'paid':`, updateError);
          } else {
            console.log(`Rent_transaction ${rentTransactionId} successfully marked as 'paid'. PI: ${stripePaymentIntentId}`);
          }
        } else {
           console.warn(`invoice.payment_succeeded (Invoice ID: ${invoice.id}) received without rent_transaction_id in metadata.`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const rentTransactionId = invoice.metadata?.rent_transaction_id;
        const failureReason = invoice.last_payment_error?.message || invoice.status_transitions?.marked_uncollectible_at ? 'Marked uncollectible' : 'Unknown reason';
        
        if (rentTransactionId) {
          console.log(`Processing invoice.payment_failed for rent_transaction_id: ${rentTransactionId}. Reason: ${failureReason}`);
          const { error: updateError } = await supabaseAdmin
            .from('rent_transactions')
            .update({ status: 'failed' })
            .eq('id', rentTransactionId);

          if (updateError) {
            console.error(`Failed to update rent_transaction ${rentTransactionId} to 'failed':`, updateError);
          } else {
            console.log(`Rent_transaction ${rentTransactionId} successfully marked as 'failed'.`);
          }
        } else {
           console.warn(`invoice.payment_failed (Invoice ID: ${invoice.id}) received without rent_transaction_id in metadata.`);
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

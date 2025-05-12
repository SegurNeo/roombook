// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@11.1.0" // Usaremos una versión que sabemos funciona bien con Deno

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace with your frontend URL in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Stripe client
// Ensure STRIPE_SECRET_KEY is set in your Supabase project's secrets
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16", // Use a specific API version
  httpClient: Stripe.createFetchHttpClient(), // Use Deno's fetch
})

// Helper function to create Supabase Admin Client
const getSupabaseAdmin = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

console.log("Hello from Functions!")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    const { booking_id } = await req.json()

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'Missing booking_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Starting SEPA charge process for booking_id: ${booking_id}`)

    // 1. Fetch booking details (including customer_id and rent_price)
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, customer_id, rent_price, deposit_amount, payment_status') // Added deposit_amount and payment_status
      .eq('id', booking_id)
      .single()

    if (bookingError) {
      console.error(`Error fetching booking ${booking_id}:`, bookingError)
      return new Response(JSON.stringify({ error: `Booking not found or error fetching: ${bookingError.message}` }), {
        status: bookingError.code === 'PGRST116' ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!bookingData) { // Should be caught by bookingError.code === 'PGRST116', but as a safeguard
      return new Response(JSON.stringify({ error: `Booking with ID ${booking_id} not found.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if payment is already processing or completed to prevent duplicate charges
    if (['processing_stripe', 'paid_stripe', 'paid_manual'].includes(bookingData.payment_status || '')) {
        console.warn(`Booking ${booking_id} payment is already processing or completed. Status: ${bookingData.payment_status}`)
        return new Response(JSON.stringify({ error: `Payment for booking ${booking_id} is already ${bookingData.payment_status}.` }), {
            status: 409, // Conflict
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const customerId = bookingData.customer_id
    // Calculate total amount to charge (rent + deposit). Ensure it's in cents.
    // Assuming rent_price and deposit_amount are stored as numeric values representing euros.
    const amountToCharge = Math.round(((bookingData.rent_price || 0) + (bookingData.deposit_amount || 0)) * 100)

    if (amountToCharge <= 0) {
         return new Response(JSON.stringify({ error: 'Invalid amount to charge. Amount must be positive.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    console.log(`Amount to charge for booking ${booking_id}: ${amountToCharge} cents.`)

    // 2. Fetch customer's Stripe details (stripe_customer_id, stripe_payment_method_id, stripe_mandate_status)
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, stripe_customer_id, stripe_payment_method_id, stripe_mandate_status')
      .eq('id', customerId)
      .single()

    if (customerError || !customerData) {
      console.error(`Error fetching customer ${customerId} for booking ${booking_id}:`, customerError)
      return new Response(JSON.stringify({ error: `Customer not found or error fetching: ${customerError?.message}` }), {
        status: customerError?.code === 'PGRST116' ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. CRITICAL: Verify mandate status and necessary Stripe IDs
    if (customerData.stripe_mandate_status !== 'active') {
      console.warn(`Mandate not active for customer ${customerId}. Status: ${customerData.stripe_mandate_status}`)
      return new Response(JSON.stringify({ error: `SEPA mandate for customer is not active. Status: ${customerData.stripe_mandate_status}` }), {
        status: 403, // Forbidden or Bad Request (400)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!customerData.stripe_customer_id || !customerData.stripe_payment_method_id) {
        console.warn(`Missing Stripe customer ID or payment method ID for customer ${customerId}.`)
        return new Response(JSON.stringify({ error: 'Customer is missing necessary Stripe payment configuration.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    console.log(`Customer ${customerId} has an active SEPA mandate and Stripe IDs.`)

    // 4. Create PaymentIntent in Stripe
    let paymentIntent
    try {
        paymentIntent = await stripe.paymentIntents.create({
            amount: amountToCharge,
            currency: 'eur',
            customer: customerData.stripe_customer_id,
            payment_method: customerData.stripe_payment_method_id,
            payment_method_types: ['sepa_debit'],
            confirm: true, // Attempt to confirm the payment immediately
            off_session: true, // Indicates the customer is not present during the transaction
            metadata: {
                supabase_booking_id: booking_id,
                supabase_customer_id: customerId,
            },
            // return_url is not strictly necessary for off_session SEPA, but can be useful for some flows if user interaction is ever needed
            // return_url: `${Deno.env.get('SITE_URL')}/booking-payment-status?payment_intent_id={REPLACE_WITH_ACTUAL_ID}`
        })
        console.log(`Stripe PaymentIntent created: ${paymentIntent.id} for booking ${booking_id}`)
    } catch (stripeError) {
        console.error(`Stripe PaymentIntent creation failed for booking ${booking_id}:`, stripeError)
        // Update booking status to failed if Stripe call fails immediately
        await supabaseAdmin
            .from('bookings')
            .update({ payment_status: 'failed_stripe', stripe_payment_intent_id: null }) // Clear PI ID if it failed
            .eq('id', booking_id)
        return new Response(JSON.stringify({ error: `Stripe error: ${stripeError.message}` }), {
            status: 500, // Or a more specific Stripe error code if available
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 5. Update booking in Supabase with PaymentIntent ID and status
    const { error: updateBookingError } = await supabaseAdmin
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'processing_stripe',
      })
      .eq('id', booking_id)

    if (updateBookingError) {
      console.error(`Failed to update booking ${booking_id} with PaymentIntent details:`, updateBookingError)
      // This is a tricky state: PaymentIntent created in Stripe, but DB update failed.
      // Log this carefully. Manual reconciliation might be needed.
      // For now, return an error, but Stripe will still process the PI.
      return new Response(JSON.stringify({ 
          error: 'Failed to update booking after creating PaymentIntent. Please check logs.',
          stripe_payment_intent_id: paymentIntent.id // Provide PI ID for manual checking
        }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Booking ${booking_id} updated. PaymentIntent: ${paymentIntent.id}, Status: processing_stripe`)

    // 6. Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'SEPA charge initiated successfully.',
      booking_id: booking_id,
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: 'processing_stripe',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unhandled error in charge-sepa-booking function:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/charge-sepa-booking' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

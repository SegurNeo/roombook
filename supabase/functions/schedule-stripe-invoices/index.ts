import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import Stripe from "https://esm.sh/stripe@14.20.0?target=deno"; // Original
import Stripe from "https://esm.sh/stripe@14.20.0?target=denonext"; // Usar denonext como en stripe-webhooks
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Definir cabeceras CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O especifica tu dominio de Netlify: 'https://roombooksegurneo.netlify.app'
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Asegúrate que 'content-type' esté aquí
};

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2023-10-16", // Specify API version or use latest
});

// Reusable function to get Supabase client
const getSupabaseClient = (req?: Request) => {
  const authHeader = req?.headers.get("Authorization");
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, 
    authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
  );
};

serve(async (req: Request) => {
  // Manejar solicitud de pre-vuelo OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 }); // 204 No Content es común para OPTIONS
  }

  // Para otras solicitudes (como POST), proceder como antes pero asegurar cabeceras CORS en la respuesta
  const supabaseClient = getSupabaseClient();
  try {
    // Asegurarse de que solo procesamos POST para la lógica principal
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const rawBody = await req.text();
    console.log("SCHEDULE-STRIPE-INVOICES - Raw request body:", rawBody);
    let booking_id: string | null = null;
    try {
        if (rawBody && rawBody.trim() !== "") {
            const bodyJSON = JSON.parse(rawBody); 
            booking_id = bodyJSON.booking_id;
        } else {
            console.warn("SCHEDULE-STRIPE-INVOICES - Request body is empty for POST.");
            return new Response(JSON.stringify({ error: "Request body is empty for POST" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    } catch (e) {
        console.error("SCHEDULE-STRIPE-INVOICES - Failed to parse request body as JSON:", e.message, "Body was:", rawBody);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id is required in JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`SCHEDULE-STRIPE-INVOICES - Processing for booking_id: ${booking_id}`);

    const selectQuery = `
        id, amount, due_date, booking_id,
        bookings!inner (customer_id, customers!inner (id, stripe_customer_id, stripe_payment_method_id, stripe_mandate_status))
      `;
    const { data: transactions, error: transactionsError } = await supabaseClient
      .from("rent_transactions")
      .select(selectQuery)
      .eq("booking_id", booking_id)
      .eq("status", "scheduled")
      .is("stripe_invoice_id", null);

    if (transactionsError) {
      console.error("SCHEDULE-STRIPE-INVOICES - Error fetching transactions:", transactionsError);
      throw transactionsError;
    }

    if (!transactions || transactions.length === 0) {
      console.log("SCHEDULE-STRIPE-INVOICES - No scheduled transactions found for this booking or they are already processed.");
      return new Response(
        JSON.stringify({ message: "No scheduled transactions found for this booking or they are already processed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    console.log(`SCHEDULE-STRIPE-INVOICES - Found ${transactions.length} transactions to process.`);

    for (const transaction of transactions) {
      const customerStripeData = transaction.bookings.customers;
      if (!customerStripeData.stripe_customer_id || !customerStripeData.stripe_payment_method_id) {
        const reason = `Missing Stripe customer ID or payment method ID on customer record.`;
        console.warn(`SCHEDULE-STRIPE-INVOICES - Skipping transaction ${transaction.id}: ${reason}`);
        results.push({ transaction_id: transaction.id, status: "skipped_missing_stripe_details", reason });
        continue;
      }
      if (customerStripeData.stripe_mandate_status !== 'active') {
        const reason = `Stripe mandate is not active (status: ${customerStripeData.stripe_mandate_status}).`;
        console.warn(`SCHEDULE-STRIPE-INVOICES - Skipping transaction ${transaction.id}: ${reason}`);
        results.push({ transaction_id: transaction.id, status: "skipped_inactive_mandate", reason });
        continue;
      }
      // ... (resto del bucle for y lógica de Stripe)
      try {
        const amountInCents = Math.round(parseFloat(transaction.amount) * 100);
        const invoiceItem = await stripe.invoiceItems.create({
            customer: customerStripeData.stripe_customer_id,
            amount: amountInCents,
            currency: "eur",
            description: `Rent transaction: ${transaction.id} for booking: ${transaction.booking_id}`,
        });
        console.log(`SCHEDULE-STRIPE-INVOICES - Created invoice item ${invoiceItem.id}`);
        
        const invoice = await stripe.invoices.create({
            customer: customerStripeData.stripe_customer_id,
            collection_method: "charge_automatically",
            default_payment_method: customerStripeData.stripe_payment_method_id,
            auto_advance: true, 
            metadata: {
                rent_transaction_id: transaction.id,
                supabase_booking_id: transaction.booking_id,
                supabase_customer_id: customerStripeData.id,
            },
        });
        console.log(`SCHEDULE-STRIPE-INVOICES - Created invoice ${invoice.id}`);

        const { error: updateError } = await supabaseClient
          .from("rent_transactions")
          .update({ stripe_invoice_id: invoice.id })
          .eq("id", transaction.id);

        if (updateError) {
          console.error(`SCHEDULE-STRIPE-INVOICES - Error updating DB:`, updateError);
          results.push({ transaction_id: transaction.id, status: "error_db_update", reason: updateError.message });
        } else {
          results.push({ transaction_id: transaction.id, status: "processed_invoice_created" });
        }
      } catch (stripeError) {
        console.error(`SCHEDULE-STRIPE-INVOICES - Stripe error:`, stripeError);
        results.push({ transaction_id: transaction.id, status: "error_stripe", reason: stripeError.message });
      }
    } // Fin del bucle for

    console.log("SCHEDULE-STRIPE-INVOICES - Processed results:", results);
    return new Response(JSON.stringify({ message: "Invoice scheduling process completed.", results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SCHEDULE-STRIPE-INVOICES - Unhandled error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}); 
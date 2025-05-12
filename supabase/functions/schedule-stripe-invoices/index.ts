import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import Stripe from "https://esm.sh/stripe@14.20.0?target=deno"; // Original
import Stripe from "https://esm.sh/stripe@14.20.0?target=denonext"; // Usar denonext como en stripe-webhooks
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const supabaseClient = getSupabaseClient();
  try {
    // Log y parseo manual del body
    const rawBody = await req.text();
    console.log("SCHEDULE-STRIPE-INVOICES - Raw request body:", rawBody);
    const bodyJSON = JSON.parse(rawBody); 
    const { booking_id } = bodyJSON;
    // Fin de log y parseo manual

    // const { booking_id } = await req.json(); // Línea original comentada

    if (!booking_id) {
// ... (resto del código sin cambios)

  } catch (error) {
    console.error("SCHEDULE-STRIPE-INVOICES - Error:", error);
    return new Response("Error processing request", { status: 500 });
  }
}); 
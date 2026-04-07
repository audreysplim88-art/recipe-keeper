import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? "").trim(), {
  apiVersion: "2026-03-25.dahlia",
  maxNetworkRetries: 1,
  timeout: 10000,
});

const PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID!,
};

export async function POST(request: NextRequest) {
  // Authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Accept either a raw priceId or a legacy plan key
  const body = await request.json();
  const priceId: string = body.priceId ?? PRICE_IDS[body.plan as string];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Validate price ID is one of the known configured prices
  const validPriceIds = new Set(Object.values(PRICE_IDS).filter(Boolean));
  if (!validPriceIds.has(priceId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    // Get or create Stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = sub?.stripe_customer_id as string | undefined;

    // Validate the stored customer still exists in this Stripe account.
    // If the account changed (e.g. during setup), the old ID will be stale.
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        // Customer not found in this Stripe account — create a fresh one
        customerId = undefined;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Persist the customer id so we can link webhook events back to this user
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Build return URLs
    const origin = request.headers.get("origin") ?? "https://recipe-keeper-eta.vercel.app";
    const successUrl = `${origin}/capture?payment=success`;
    const cancelUrl = `${origin}/capture?payment=cancelled`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-checkout-session]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

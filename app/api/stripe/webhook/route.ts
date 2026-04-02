import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Stripe client ───────────────────────────────────────────────────────────

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? "").trim(), {
  apiVersion: "2026-03-25.dahlia",
  maxNetworkRetries: 1,
  timeout: 10000,
});

const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();

// ─── Price ID → plan name mapping ────────────────────────────────────────────

const PRICE_TO_PLAN: Record<string, "monthly" | "annual"> = {
  [(process.env.STRIPE_MONTHLY_PRICE_ID ?? "").trim()]: "monthly",
  [(process.env.STRIPE_ANNUAL_PRICE_ID ?? "").trim()]: "annual",
};

function priceToPlan(priceId: string): "free" | "monthly" | "annual" {
  return PRICE_TO_PLAN[priceId] ?? "free";
}

// ─── Stripe status → app status mapping ──────────────────────────────────────

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "canceled" | "past_due" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return "canceled";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * In Stripe SDK v21 (dahlia API), `current_period_end` lives on the
 * subscription *item*, not the subscription itself.
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : new Date().toISOString();
}

/**
 * In Stripe SDK v21, Invoice.subscription is replaced by
 * invoice.parent.subscription_details.subscription.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

// ─── Event handlers ──────────────────────────────────────────────────────────

/**
 * checkout.session.completed
 *
 * Fired when a user completes Stripe Checkout. The `supabase_user_id`
 * metadata lives on the Stripe Subscription (set during session creation
 * in create-checkout-session/route.ts), so we retrieve the full subscription
 * object to read it.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.warn("[stripe-webhook] checkout.session.completed: no subscription ID");
    return;
  }

  // Retrieve the full subscription to access metadata + price info
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[stripe-webhook] checkout.session.completed: no supabase_user_id in metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? "";

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: priceToPlan(priceId),
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: getSubscriptionPeriodEnd(subscription),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[stripe-webhook] checkout.session.completed: Supabase update failed", error);
    throw error;
  }
}

/**
 * customer.subscription.updated
 *
 * Fired on plan changes, renewals, and payment status transitions.
 * The subscription object in the event payload already contains the
 * metadata with `supabase_user_id`.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[stripe-webhook] customer.subscription.updated: no supabase_user_id in metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? "";

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: priceToPlan(priceId),
      status: mapStripeStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      current_period_end: getSubscriptionPeriodEnd(subscription),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[stripe-webhook] customer.subscription.updated: Supabase update failed", error);
    throw error;
  }
}

/**
 * customer.subscription.deleted
 *
 * Fired when a subscription is fully cancelled (end of billing period
 * or immediate cancellation). Resets the user to the free plan.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[stripe-webhook] customer.subscription.deleted: no supabase_user_id in metadata");
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      stripe_subscription_id: subscription.id,
      current_period_end: getSubscriptionPeriodEnd(subscription),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[stripe-webhook] customer.subscription.deleted: Supabase update failed", error);
    throw error;
  }
}

/**
 * invoice.payment_failed
 *
 * Fired when a recurring payment fails. Only updates `status` to `past_due`
 * — the user's plan is unchanged because they're still entitled until the
 * end of the billing period.
 *
 * Looks up the user by `stripe_subscription_id` (already populated by a
 * prior checkout or subscription.updated event).
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    console.warn("[stripe-webhook] invoice.payment_failed: no subscription ID");
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("[stripe-webhook] invoice.payment_failed: Supabase update failed", error);
    throw error;
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Step 1: Read raw body for signature verification
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  // Step 2: Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Step 3: Route by event type
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event type — acknowledge receipt so Stripe doesn't retry
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] Handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

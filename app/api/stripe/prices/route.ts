import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export interface StripePriceInfo {
  id: string;
  /** Amount in major currency units (e.g. 5.99 for £5.99) */
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  /** Human-readable label, e.g. "every 3 months" or "per year" */
  label: string;
  /** Cost normalised to a monthly equivalent for saving calculations */
  monthly_equivalent: number;
}

export interface StripePricesResponse {
  primary: StripePriceInfo;   // shown first (typically the better-value plan)
  secondary: StripePriceInfo;
}

function buildPriceInfo(price: Stripe.Price): StripePriceInfo {
  const amount = (price.unit_amount ?? 0) / 100;
  const interval = price.recurring?.interval ?? "month";
  const interval_count = price.recurring?.interval_count ?? 1;
  const currency = price.currency.toUpperCase();

  // Label e.g. "every 3 months" / "per year" / "per month"
  let label: string;
  if (interval === "year") {
    label = interval_count === 1 ? "per year" : `every ${interval_count} years`;
  } else {
    label = interval_count === 1 ? "per month" : `every ${interval_count} months`;
  }

  // Normalise to monthly for saving % calculations
  const months =
    interval === "year" ? interval_count * 12 : interval_count;
  const monthly_equivalent = amount / months;

  return { id: price.id, amount, currency, interval, interval_count, label, monthly_equivalent };
}

export async function GET() {
  const [price1, price2] = await Promise.all([
    stripe.prices.retrieve(process.env.STRIPE_MONTHLY_PRICE_ID!),
    stripe.prices.retrieve(process.env.STRIPE_ANNUAL_PRICE_ID!),
  ]);

  const info1 = buildPriceInfo(price1);
  const info2 = buildPriceInfo(price2);

  // Show the better value plan first (lower monthly equivalent)
  const [primary, secondary] =
    info1.monthly_equivalent <= info2.monthly_equivalent
      ? [info1, info2]
      : [info2, info1];

  return NextResponse.json({ primary, secondary } satisfies StripePricesResponse);
}

"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";
import type { StripePriceInfo, StripePricesResponse } from "@/app/api/stripe/prices/route";

interface Props {
  onClose: () => void;
}

function formatAmount(info: StripePriceInfo): string {
  const symbol = info.currency === "GBP" ? "£" : info.currency + " ";
  return `${symbol}${info.amount.toFixed(2)}`;
}

function savingPct(cheaper: StripePriceInfo, pricier: StripePriceInfo): number {
  return Math.round(
    ((pricier.monthly_equivalent - cheaper.monthly_equivalent) /
      pricier.monthly_equivalent) *
      100
  );
}

export default function PaywallModal({ onClose }: Props) {
  const native = isNativeApp();

  // ── Fetch live prices from Stripe ──────────────────────────────────────────
  const [prices, setPrices] = useState<StripePricesResponse | null>(null);
  const [pricesError, setPricesError] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/prices")
      .then((r) => r.json())
      .then((data) => setPrices(data))
      .catch(() => setPricesError(true));
  }, []);

  // ── Selected plan (default to primary / better-value) ─────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Once prices load, default to the primary (better-value) plan
  useEffect(() => {
    if (prices && !selectedId) setSelectedId(prices.primary.id);
  }, [prices, selectedId]);

  // ── Checkout ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (native || !selectedId) return;
    setLoading(true);
    setCheckoutError(null);

    // Determine plan key from price id
    const plan =
      selectedId === prices?.primary.id ? "primary" : "secondary";

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: selectedId, plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const planList: StripePriceInfo[] = prices
    ? [prices.primary, prices.secondary]
    : [];

  const saving =
    prices && prices.primary.monthly_equivalent < prices.secondary.monthly_equivalent
      ? savingPct(prices.primary, prices.secondary)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-amber-800 px-6 pt-6 pb-5 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-300 hover:text-white text-xl leading-none"
            aria-label="Close"
          >×</button>
          <p className="text-3xl mb-2">👨‍🍳</p>
          <h2 className="text-xl font-bold">Unlock Your Recipe Library</h2>
          <p className="text-amber-200 text-sm mt-1">
            You&apos;ve hit the 3-recipe free limit.<br />
            Go unlimited with Dodol Pro.
          </p>
        </div>

        <div className="px-6 py-5">
          {/* Feature list */}
          <ul className="space-y-2 mb-5">
            {[
              "Unlimited recipes saved forever",
              "Access from any device",
              "Full Sous Chef mode",
              "Photo & URL capture",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-700">
                <span className="text-amber-600">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Plan selector */}
          {pricesError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
              Could not load pricing. Please try again later.
            </p>
          ) : !prices ? (
            /* Loading skeleton */
            <div className="space-y-2 mb-5">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 mb-5">
              {planList.map((price, i) => {
                const isPrimary = i === 0;
                const selected = selectedId === price.id;
                return (
                  <button
                    key={price.id}
                    onClick={() => setSelectedId(price.id)}
                    className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors text-left ${
                      selected
                        ? "border-amber-600 bg-amber-50"
                        : "border-stone-200 hover:border-amber-300"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                        {price.interval_count === 1
                          ? price.interval.charAt(0).toUpperCase() + price.interval.slice(1) + "ly"
                          : `Every ${price.interval_count} ${price.interval}s`}
                        {isPrimary && saving !== null && (
                          <span className="text-xs font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                            Save {saving}%
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        ≈ £{price.monthly_equivalent.toFixed(2)}/month
                      </p>
                    </div>
                    <p className="text-base font-bold text-stone-800 shrink-0">
                      {formatAmount(price)}<span className="text-xs font-normal text-stone-500 ml-0.5"> {price.label}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Checkout error */}
          {checkoutError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {checkoutError}
            </p>
          )}

          {/* CTA */}
          {native ? (
            <div className="text-center text-sm text-stone-500 bg-stone-50 rounded-xl px-4 py-3 mb-3">
              In-app purchase coming soon.<br />
              Subscribe at <span className="font-medium text-amber-700">dodol.app</span> for now.
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading || !prices || !selectedId}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {loading ? "Opening checkout…" : "Subscribe now"}
            </button>
          )}

          <p className="text-center text-xs text-stone-400 mt-3">
            Secure payment via Stripe · Cancel any time
          </p>
        </div>
      </div>
    </div>
  );
}

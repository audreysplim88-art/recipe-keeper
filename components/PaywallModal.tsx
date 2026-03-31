"use client";

import { useState } from "react";
import { isNativeApp } from "@/lib/platform";
import { MONTHLY_PRICE_GBP, ANNUAL_PRICE_GBP } from "@/lib/constants";

interface Props {
  onClose: () => void;
}

type Plan = "monthly" | "annual";

// Annual saving vs paying monthly for 12 months
const annualSavingPct = Math.round(
  ((MONTHLY_PRICE_GBP * 12 - ANNUAL_PRICE_GBP) / (MONTHLY_PRICE_GBP * 12)) * 100
);

export default function PaywallModal({ onClose }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const native = isNativeApp();

  async function handleSubscribe() {
    if (native) return; // IAP handled separately in Issue 6
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        return;
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
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
          >
            ×
          </button>
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
          <div className="space-y-2 mb-5">
            {/* Annual */}
            <button
              onClick={() => setSelectedPlan("annual")}
              className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors ${
                selectedPlan === "annual"
                  ? "border-amber-600 bg-amber-50"
                  : "border-stone-200 hover:border-amber-300"
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-stone-800">
                  Annual
                  <span className="ml-2 text-xs font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                    Save {annualSavingPct}%
                  </span>
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  £{(ANNUAL_PRICE_GBP / 12).toFixed(2)}/month — billed annually
                </p>
              </div>
              <p className="text-base font-bold text-stone-800 shrink-0">
                £{ANNUAL_PRICE_GBP}/yr
              </p>
            </button>

            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors ${
                selectedPlan === "monthly"
                  ? "border-amber-600 bg-amber-50"
                  : "border-stone-200 hover:border-amber-300"
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-stone-800">Monthly</p>
                <p className="text-xs text-stone-500 mt-0.5">Billed monthly, cancel any time</p>
              </div>
              <p className="text-base font-bold text-stone-800 shrink-0">
                £{MONTHLY_PRICE_GBP}/mo
              </p>
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
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
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {loading ? "Opening checkout…" : `Start ${selectedPlan === "annual" ? "Annual" : "Monthly"} Plan`}
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

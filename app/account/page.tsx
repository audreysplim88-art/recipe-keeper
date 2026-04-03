"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { hasActiveSubscription, getRecipeCount } from "@/lib/subscription";
import { FREE_RECIPE_LIMIT } from "@/lib/constants";
import type { UserSubscription } from "@/lib/auth-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getPlanLabel(sub: UserSubscription | null): string {
  if (!sub || sub.plan === "free") return "Free Plan";
  const tier = sub.plan === "monthly" ? "Monthly" : "Annual";
  if (sub.status === "canceled") return "Pro — Cancelled";
  if (sub.status === "past_due") return "Pro — Payment Issue";
  return `Pro — ${tier}`;
}

function getPlanBadgeClass(sub: UserSubscription | null): string {
  if (!sub || sub.plan === "free")
    return "bg-stone-100 text-stone-500 border border-stone-200";
  if (sub.status === "past_due")
    return "bg-red-100 text-red-700 border border-red-200";
  if (sub.status === "canceled")
    return "bg-stone-100 text-stone-600 border border-stone-200";
  return "bg-amber-100 text-amber-800 border border-amber-200";
}

function getPeriodLine(sub: UserSubscription): string | null {
  if (!sub.current_period_end) return null;
  const date = formatDate(sub.current_period_end);
  return sub.status === "canceled" ? `Expires on ${date}` : `Renews on ${date}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, subscription, refreshProfile } = useAuth();
  const supabase = createClient();

  // ── Name edit state ───────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Stripe portal state ───────────────────────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // ── Recipe count (free users only) ────────────────────────────────────────
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [recipeCountError, setRecipeCountError] = useState(false);

  useEffect(() => {
    if (hasActiveSubscription(subscription)) return;
    getRecipeCount()
      .then(setRecipeCount)
      .catch(() => setRecipeCountError(true));
  }, [subscription]);

  // Prevent flicker during hydration while auth state loads
  if (!user || !profile) {
    return <div className="min-h-screen bg-stone-100" />;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function startEditingName() {
    setNameInput(profile!.first_name);
    setNameError(null);
    setNameSuccess(false);
    setEditingName(true);
  }

  function cancelEditingName() {
    setEditingName(false);
    setNameInput("");
    setNameError(null);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError("Name cannot be empty.");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: trimmed })
      .eq("id", user!.id);
    if (error) {
      setNameError(error.message ?? "Could not save name. Please try again.");
      setNameSaving(false);
      return;
    }
    await refreshProfile();
    setEditingName(false);
    setNameSaving(false);
    setNameSuccess(true);
    setTimeout(() => setNameSuccess(false), 3000);
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setPortalError(data.error ?? "Could not open billing portal. Please try again.");
        setPortalLoading(false);
        return;
      }
      // Intentionally keep portalLoading true — page unmounts on redirect
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Network error. Please try again.");
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const isPaid = subscription !== null && subscription.plan !== "free";
  const initial = (profile.first_name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  const periodLine = subscription && subscription.plan !== "free"
    ? getPeriodLine(subscription)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Nav */}
      <nav className="bg-amber-800 text-white px-4 sm:px-6 pb-4 flex items-center gap-3" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <Link href="/" className="text-amber-200 hover:text-white transition-colors text-sm shrink-0">
          ← Back
        </Link>
        <h1 className="font-serif text-lg sm:text-xl font-bold">Account</h1>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 pb-[max(2rem,env(safe-area-inset-bottom))]">

        {/* ── Profile Card ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide mb-5">
            Profile
          </h2>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-600 text-white font-bold text-xl sm:text-2xl flex items-center justify-center shrink-0">
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name row */}
              {editingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !nameSaving && handleSaveName()}
                    autoFocus
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Your name"
                  />
                  {nameError && (
                    <p className="text-xs text-red-600">{nameError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveName}
                      disabled={nameSaving}
                      className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-sm font-semibold rounded-full transition-colors"
                    >
                      {nameSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={cancelEditingName}
                      disabled={nameSaving}
                      className="px-4 py-1.5 border border-stone-300 text-stone-600 text-sm rounded-full hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-lg font-bold text-stone-800">{profile.first_name}</p>
                  <button
                    onClick={startEditingName}
                    className="text-stone-400 hover:text-amber-700 transition-colors text-sm"
                    aria-label="Edit name"
                  >
                    ✏️
                  </button>
                </div>
              )}

              {/* Success flash */}
              {nameSuccess && !editingName && (
                <p className="text-xs text-green-700 mb-1">Name updated ✓</p>
              )}

              {/* Email */}
              <p className="text-sm text-stone-500">{user.email}</p>

              {/* Member since */}
              <p className="text-xs text-stone-400 mt-1">
                Member since {formatDate(user.created_at)}
              </p>
            </div>
          </div>
        </section>

        {/* ── Subscription Card ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide mb-5">
            Subscription
          </h2>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {/* Plan badge */}
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${getPlanBadgeClass(subscription)}`}>
                {getPlanLabel(subscription)}
              </span>

              {/* Renewal / expiry date */}
              {periodLine && (
                <p className="text-sm text-stone-500 mt-2">{periodLine}</p>
              )}
            </div>
          </div>

          {/* Paid user: manage subscription */}
          {isPaid && (
            <div>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-sm font-semibold rounded-full transition-colors"
              >
                {portalLoading ? "Opening portal…" : "Manage subscription"}
              </button>
              {portalError && (
                <p className="mt-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">
                  {portalError}
                </p>
              )}
            </div>
          )}

          {/* Free user: usage + upgrade */}
          {!isPaid && (
            <div className="space-y-3">
              {!recipeCountError && (
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                    <span>Free recipes used</span>
                    <span>
                      {recipeCount !== null ? recipeCount : "…"} / {FREE_RECIPE_LIMIT}
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div
                      className="bg-amber-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          ((recipeCount ?? 0) / FREE_RECIPE_LIMIT) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <Link
                href="/capture"
                className="inline-block px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-full transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}
        </section>

        {/* ── Account Actions Card ─────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide mb-5">
            Account
          </h2>
          <button
            onClick={handleSignOut}
            className="px-6 py-2.5 border border-stone-300 text-stone-600 text-sm font-semibold rounded-full hover:bg-stone-50 transition-colors"
          >
            Sign out
          </button>
        </section>

      </div>
    </div>
  );
}

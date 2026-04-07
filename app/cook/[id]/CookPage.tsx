"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecipe } from "@/lib/storage";
import { Recipe } from "@/lib/types";
import SousChefSession from "@/components/SousChefSession";
import PaywallModal from "@/components/PaywallModal";
import { useAuth } from "@/lib/auth-context";

export default function CookPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const { subscription, loading: authLoading } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined); // undefined = loading
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!id) {
      setRecipe(null);
      return;
    }
    getRecipe(id).then(setRecipe).catch(() => setRecipe(null));
  }, [id]);

  // A paid user has an active non-free plan
  const isPaid =
    subscription !== null &&
    subscription?.plan !== "free" &&
    subscription?.status === "active";

  // Loading — wait for both recipe and auth to resolve
  if (recipe === undefined || authLoading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not found
  if (recipe === null) {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-2xl font-bold text-gray-300">Recipe not found</p>
        <p className="text-gray-500 text-sm">This recipe may have been deleted.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
        >
          Back to recipes
        </button>
      </div>
    );
  }

  // Free user — show the paywall gate screen
  if (!isPaid) {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-6 px-6">
        {/* Back button */}
        <button
          onClick={() => router.push(`/recipe/${recipe.id}`)}
          className="absolute top-4 left-4 p-2 -m-2 flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Back to recipe"
        >
          ← Back to Recipe
        </button>

        {/* Icon */}
        <div className="text-5xl">👨‍🍳</div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <h1 className="text-2xl font-bold text-white">Sous Chef</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your hands-free cooking assistant is a Dodol premium feature. Upgrade to get
            a guided, voice-led cooking experience for every recipe.
          </p>
        </div>

        {/* Upgrade button */}
        <button
          onClick={() => setShowPaywall(true)}
          className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold text-base px-8 py-4 rounded-2xl transition-colors shadow-lg"
        >
          Upgrade to Premium
        </button>

        {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      </div>
    );
  }

  return (
    <SousChefSession
      recipe={recipe}
      onExit={() => router.push(`/recipe/${recipe.id}`)}
    />
  );
}

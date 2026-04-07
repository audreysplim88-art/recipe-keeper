"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Detects recipe URLs on the clipboard (placed by the iOS Share Extension)
 * and shows a floating prompt offering to import the recipe.
 *
 * Rendered at the root layout level so it works from any page.
 */

const URL_PATTERN = /^https?:\/\/.+/i;

// Domains that are very likely to contain recipes
const RECIPE_HINTS = [
  "allrecipes", "food", "recipe", "cook", "bbc", "delish",
  "epicurious", "tasty", "bonappetit", "seriouseats", "simplyrecipes",
  "instagram.com", "tiktok.com",
];

function looksLikeRecipeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return RECIPE_HINTS.some((hint) => lower.includes(hint));
}

export default function ClipboardImportPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Check clipboard when the app comes to foreground
  useEffect(() => {
    // Skip if already on capture page or dismissed
    if (pathname === "/capture" || dismissed) return;

    async function checkClipboard() {
      try {
        // navigator.clipboard.readText requires user gesture on some browsers,
        // but Capacitor's native context typically allows it on app foreground.
        const text = await navigator.clipboard.readText();
        if (text && URL_PATTERN.test(text.trim()) && looksLikeRecipeUrl(text.trim())) {
          setClipboardUrl(text.trim());
        }
      } catch {
        // Clipboard API not available or permission denied — no-op
      }
    }

    // Check on mount
    checkClipboard();

    // Also check when app returns to foreground
    const handleFocus = () => checkClipboard();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkClipboard();
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname, dismissed]);

  const handleImport = useCallback(() => {
    if (!clipboardUrl) return;
    // Clear clipboard so we don't prompt again
    navigator.clipboard.writeText("").catch(() => {});
    router.push(`/capture?importUrl=${encodeURIComponent(clipboardUrl)}`);
    setClipboardUrl(null);
  }, [clipboardUrl, router]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setClipboardUrl(null);
    // Clear clipboard so we don't prompt again this session
    navigator.clipboard.writeText("").catch(() => {});
  }, []);

  if (!clipboardUrl) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-lg mx-auto">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Recipe link detected</p>
          <p className="text-gray-400 text-xs truncate mt-0.5">{clipboardUrl}</p>
        </div>
        <button
          onClick={handleImport}
          className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Import
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-500 hover:text-gray-300 p-1 -m-1 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

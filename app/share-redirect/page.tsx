"use client";

import { useEffect } from "react";

/**
 * Tiny trampoline page used by the iOS Share Extension.
 *
 * Flow:
 *   1. Share Extension opens https://…/share-redirect?url=<recipe-url>
 *   2. This page immediately redirects to dodol://import?url=<recipe-url>
 *   3. iOS opens the Dodol app via its registered custom URL scheme
 *
 * If the redirect doesn't work (e.g. app not installed), the fallback
 * message below is shown.
 */
export default function ShareRedirectPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipeUrl = params.get("url");

    if (recipeUrl) {
      const dodolUrl = `dodol://import?url=${encodeURIComponent(recipeUrl)}`;
      window.location.href = dodolUrl;
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Opening Dodol…</p>
      <p className="text-gray-400 text-sm">
        If the app doesn&rsquo;t open,{" "}
        <a href="https://apps.apple.com/app/dodol" className="text-amber-400 underline">
          install Dodol
        </a>{" "}
        and try again.
      </p>
    </div>
  );
}

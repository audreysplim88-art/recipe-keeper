"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform: () => boolean };
  }
}

/**
 * Listens for `dodol://import?url=…` URLs opened by the iOS Share Extension
 * and navigates to the capture page with the recipe URL pre-filled.
 *
 * Rendered once at the root layout level so it is always active, regardless
 * of which page the user is on.  Returns null (no visible UI).
 */
export default function CapacitorUrlHandler() {
  const router = useRouter();

  useEffect(() => {
    // Only run inside the native Capacitor shell
    if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    import("@capacitor/app").then(({ App }) => {
      // ── Cold-start: app was launched via the URL scheme ──────────────────
      App.getLaunchUrl().then((result) => {
        if (result?.url) navigate(result.url);
      });

      // ── Warm: app was already running / backgrounded ─────────────────────
      App.addListener("appUrlOpen", (event) => {
        navigate(event.url);
      }).then((handle) => {
        listenerHandle = handle;
      });
    });

    return () => {
      listenerHandle?.remove();
    };
  // router is stable; [] would also work, but including it satisfies the linter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(raw: string) {
    try {
      // Expected shape: dodol://import?url=https://…
      const parsed = new URL(raw);
      if (parsed.hostname !== "import") return;

      const recipeUrl = parsed.searchParams.get("url");
      if (!recipeUrl) return;

      router.push(`/capture?importUrl=${encodeURIComponent(recipeUrl)}`);
    } catch {
      // Ignore malformed URLs
    }
  }

  return null;
}

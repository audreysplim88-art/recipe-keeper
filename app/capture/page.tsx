"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import VoiceCapture from "@/components/VoiceCapture";
import PhotoCapture, { CapturedPhoto } from "@/components/PhotoCapture";
import { saveRecipe, generateId } from "@/lib/storage";
import { Recipe, RecipeGenerationResult } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { canCreateRecipe } from "@/lib/subscription";
import PaywallModal from "@/components/PaywallModal";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { API_BASE } from "@/lib/api";
import {
  CAPTURE_BACKUP_KEY,
  CAPTURE_BACKUP_INTERVAL_MS,
  CAPTURE_MIN_CONTENT_CHARS,
} from "@/lib/constants";

type Stage = "capture" | "generating" | "preview";
type InputMode = "narrate" | "paste" | "url" | "photo";

const UNSAVED_WARNING = "You have an unsaved recipe. If you leave now it will be lost — are you sure?";

const INPUT_MODES: { id: InputMode; label: string; shortLabel: string }[] = [
  { id: "narrate", label: "Narrate",    shortLabel: "Narrate" },
  { id: "paste",   label: "Paste",     shortLabel: "Paste"   },
  { id: "url",     label: "From URL",  shortLabel: "URL"     },
  { id: "photo",   label: "Photo",     shortLabel: "Photo"   },
];

const MODE_HINTS: Record<InputMode, { heading: string; body: string }> = {
  narrate: {
    heading: "Tell Me Your Recipe",
    body: "Tell me about a new recipe you've just created or talk to me while you're cooking, detailing the ingredients and methods you're using. I'll listen and capture everything!",
  },
  paste: {
    heading: "Copy and Paste a Written Recipe",
    body: "Already have a digital copy of your recipes? You can choose to add them to your recipe library by copying and pasting the recipe's text here. I will do the rest!",
  },
  url: {
    heading: "Import from a URL",
    body: "Came across a recipe from a blog or on social media you want to keep? Or perhaps you're just tired of long blog posts and distracting ads. If it's a publicly accessible URL, or the recipe is written in the social media post's description, you can paste the URL here and I'll do my magic!",
  },
  photo: {
    heading: "Snap a Recipe",
    body: "Seen a recipe in a magazine, book or physical card and want to keep it in your recipe library? Take a photo of the recipe or drop your photos of it here. I will read across the images and build your card.",
  },
};

export default function CapturePage() {
  const router = useRouter();
  const { subscription, refreshProfile } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  // Handle return from Stripe Checkout
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    if (status === "success" || status === "cancelled") {
      setPaymentStatus(status);
      // Refresh subscription state so the paywall re-evaluates
      if (status === "success") refreshProfile();
      // Clean the URL
      router.replace("/capture");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle recipe URL shared from iOS Share Extension (dodol://import?url=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importUrl = params.get("importUrl");
    if (importUrl) {
      setInputMode("url");
      setUrlInput(decodeURIComponent(importUrl));
      // Clean the URL so a refresh doesn't re-trigger the import
      router.replace("/capture");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [inputMode, setInputMode] = useState<InputMode>("narrate");
  const [transcript, setTranscript] = useState("");   // narrate + paste share this
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<RecipeGenerationResult | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const lastBackupTimeRef = useRef<number>(0);

  // Warn on browser refresh / tab close whenever there is unsaved content:
  // - capture stage: user has typed/narrated content, or has taken photos, but not yet generated
  // - preview stage: recipe was generated but not yet saved
  const hasCaptureContent =
    ((inputMode === "narrate" || inputMode === "paste") && transcript.trim().length >= CAPTURE_MIN_CONTENT_CHARS) ||
    (inputMode === "photo" && photos.length > 0);
  useUnsavedChangesWarning(hasCaptureContent || stage === "preview");

  // Check for backup on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CAPTURE_BACKUP_KEY);
      if (raw) {
        const backup = JSON.parse(raw) as { transcript: string; savedAt: string };
        if (backup.transcript && backup.transcript.trim().length > CAPTURE_MIN_CONTENT_CHARS) {
          setShowRestoreBanner(true);
        }
      }
    } catch {
      // Corrupt backup — ignore
    }
  }, []);

  // Auto-save narration to sessionStorage (at most once per 30 s)
  useEffect(() => {
    if (inputMode !== "narrate" || transcript.trim().length < CAPTURE_MIN_CONTENT_CHARS) return;
    const now = Date.now();
    if (now - lastBackupTimeRef.current < CAPTURE_BACKUP_INTERVAL_MS) return;
    lastBackupTimeRef.current = now;
    try {
      sessionStorage.setItem(
        CAPTURE_BACKUP_KEY,
        JSON.stringify({ transcript, savedAt: new Date().toISOString() })
      );
    } catch {
      // Storage full or unavailable — silently skip
    }
  }, [transcript, inputMode]);

  // Guard for in-app navigation when there is unsaved content
  const safeNavigate = useCallback((destination: string) => {
    const hasUnsaved = hasCaptureContent || stage === "preview";
    if (hasUnsaved) {
      if (!window.confirm(UNSAVED_WARNING)) return;
    }
    router.push(destination);
  }, [hasCaptureContent, stage, router]);

  const handleNavBack = () => safeNavigate("/");

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setError(null);
  };

  const handleRestoreBackup = () => {
    try {
      const raw = sessionStorage.getItem(CAPTURE_BACKUP_KEY);
      if (raw) {
        const backup = JSON.parse(raw) as { transcript: string };
        setTranscript(backup.transcript);
        setInputMode("narrate");
      }
    } catch {
      // Ignore
    }
    setShowRestoreBanner(false);
  };

  const handleDismissBackup = () => {
    sessionStorage.removeItem(CAPTURE_BACKUP_KEY);
    setShowRestoreBanner(false);
  };

  /** Fetch a URL server-side and populate the paste textarea with the extracted text. */
  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setError(null);
    setUrlFetching(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(`${API_BASE}/api/import-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Could not fetch that URL.");
        return;
      }
      // Hand the extracted text straight off to Claude
      await runRecipeRequest(`${API_BASE}/api/generate-recipe`, {
        transcript: data.text,
        source: data.source ?? "url",
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The URL took too long to load. Please try again or paste the recipe text directly.");
      } else {
        setError("Network error fetching the URL. Please check your connection.");
      }
    } finally {
      setUrlFetching(false);
    }
  };

  /**
   * POST to a recipe-generation endpoint and drive the stage transitions.
   * Handles the generating → preview (success) and generating → capture (error)
   * flow in one place so the two generation paths stay in sync.
   *
   * A 65-second AbortController timeout ensures the page always recovers if the
   * server is slow or the connection silently drops.
   */
  const runRecipeRequest = async (url: string, body: Record<string, unknown>) => {
    setError(null);
    setStage("generating");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
        setStage("capture");
        return;
      }
      setGeneratedRecipe(data.recipe);
      setRecipeName(data.recipe.title);
      setStage("preview");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Generation timed out — the recipe may have been too long. Please try again, or split it into smaller sections.");
      } else {
        setError("Network error. Please check your connection and try again.");
      }
      setStage("capture");
    }
  };

  const handleGenerate = async () => {
    if (inputMode === "url") {
      await handleFetchUrl();
      return;
    }
    if (inputMode === "photo") {
      await runRecipeRequest(`${API_BASE}/api/generate-recipe-from-images`, {
        images: photos.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
      });
      return;
    }
    if (transcript.trim().length < CAPTURE_MIN_CONTENT_CHARS) {
      setError(inputMode === "narrate"
        ? "Please narrate a bit more before generating — tell me about the dish!"
        : "Please paste some recipe text before generating.");
      return;
    }
    await runRecipeRequest(`${API_BASE}/api/generate-recipe`, {
      transcript,
      source: inputMode === "narrate" ? "narration" : "text",
    });
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!generatedRecipe) return;

    // Check paywall before committing the save
    const allowed = await canCreateRecipe(subscription);
    if (!allowed) {
      setShowPaywall(true);
      return;
    }

    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: generateId(),
      ...generatedRecipe,
      title: recipeName || generatedRecipe.title,
      createdAt: now,
      updatedAt: now,
    };
    setSaving(true);
    try {
      await saveRecipe(recipe);
    } catch {
      setError("Something went wrong saving your recipe. Please try again.");
      setSaving(false);
      return;
    }
    sessionStorage.removeItem(CAPTURE_BACKUP_KEY); // clear safety net after successful save
    router.refresh();
    router.push(`/recipe/${recipe.id}`);
  };

  const handleStartOver = () => {
    if (stage === "preview") {
      if (!window.confirm(UNSAVED_WARNING)) return;
    }
    setStage("capture");
    setGeneratedRecipe(null);
    setPhotos([]);
    setError(null);
  };

  const canGenerate =
    inputMode === "url"   ? urlInput.trim().length > 0 :
    inputMode === "photo" ? photos.length > 0 :
    transcript.trim().length >= CAPTURE_MIN_CONTENT_CHARS;

  const generateLabel =
    urlFetching           ? "Fetching page…" :
    inputMode === "url"   ? "Import Recipe" :
    inputMode === "photo" ? `Read Photo${photos.length !== 1 ? "s" : ""}` :
    "Generate Recipe";

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Paywall modal */}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}

      {/* Payment return banners */}
      {paymentStatus === "success" && (
        <div className="bg-green-100 border-b border-green-300 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-green-800 text-sm font-medium">
            🎉 Welcome to Dodol Pro! Your subscription is active — save as many recipes as you like.
          </p>
          <button onClick={() => setPaymentStatus(null)} className="text-green-600 hover:text-green-800 text-lg leading-none shrink-0">×</button>
        </div>
      )}
      {paymentStatus === "cancelled" && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-amber-800 text-sm">Checkout cancelled — your recipes are still here whenever you&apos;re ready.</p>
          <button onClick={() => setPaymentStatus(null)} className="text-amber-600 hover:text-amber-800 text-lg leading-none shrink-0">×</button>
        </div>
      )}

      {/* Restore banner */}
      {showRestoreBanner && (
        <div className="bg-amber-100 border-b border-amber-300 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-amber-800 text-sm">
            📝 We found an unsaved narration from a previous session.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleRestoreBackup}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
            >
              Restore
            </button>
            <button
              onClick={handleDismissBackup}
              className="px-3 py-1 rounded-lg bg-stone-300 hover:bg-stone-400 text-stone-700 text-sm transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-amber-800 text-white px-4 sm:px-6 pb-4 flex items-center justify-between" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button onClick={handleNavBack} className="text-amber-200 hover:text-white transition-colors text-sm shrink-0">
          ← Recipe Library
        </button>
        <h1 className="font-serif text-lg sm:text-xl font-bold">Capture a Recipe</h1>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {stage === "capture" && (
          <>
            {/* Input mode tabs */}
            <div className="flex gap-1 bg-stone-200 rounded-xl p-1 mb-6" data-tour="capture-tabs">
              {INPUT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(mode.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    inputMode === mode.id
                      ? "bg-white text-amber-800 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  <span className="sm:hidden">{mode.shortLabel}</span>
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Context hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-amber-800 mb-1">{MODE_HINTS[inputMode].heading}</h2>
              <p className="text-amber-700 text-sm leading-relaxed">{MODE_HINTS[inputMode].body}</p>
            </div>

            {/* Input area — fixed min-height so button stays in place across tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6 mb-4 min-h-[16rem]">
              {inputMode === "narrate" && (
                <VoiceCapture transcript={transcript} onTranscriptChange={setTranscript} />
              )}

              {inputMode === "paste" && (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste your recipe text here — from a blog, spreadsheet, Word document etc."
                  className="w-full h-48 sm:h-64 p-4 border-2 border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 text-stone-700 bg-amber-50 text-base leading-relaxed"
                />
              )}

              {inputMode === "url" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    Recipe page URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && canGenerate && !urlFetching && handleGenerate()}
                      placeholder="https://www.instagram.com/reel/... or any recipe page URL"
                      className="flex-1 min-w-0 px-4 py-3 border-2 border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-stone-700 bg-amber-50 text-base"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text?.trim()) setUrlInput(text.trim());
                        } catch {
                          // Clipboard not available
                        }
                      }}
                      className="shrink-0 px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium rounded-xl border-2 border-amber-200 transition-colors text-sm"
                    >
                      Paste
                    </button>
                  </div>
                  <p className="text-xs text-stone-400">
                    The page must be publicly accessible. If it&apos;s behind a login or paywall, copy and paste the text instead.
                  </p>
                </div>
              )}

              {inputMode === "photo" && (
                <PhotoCapture photos={photos} onPhotosChange={setPhotos} />
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || urlFetching}
                className="w-full sm:w-auto px-8 py-3.5 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors shadow-md text-base"
              >
                {generateLabel}
              </button>
            </div>
          </>
        )}

        {stage === "generating" && (
          <div className="text-center py-24">
            <div className="text-6xl mb-6 animate-bounce">{inputMode === "photo" ? "📷" : "🍳"}</div>
            <h2 className="text-2xl font-serif font-bold text-stone-700 mb-2">
              {inputMode === "photo" ? "Reading your photos…" : "Reading between the lines…"}
            </h2>
            <p className="text-stone-500">
              {inputMode === "photo"
                ? "I'm reading across your photos and pulling the recipe together."
                : "I'm finding the recipe, extracting the tips, tricks and secrets."}
            </p>
          </div>
        )}

        {stage === "preview" && generatedRecipe && (
          <>
            {/* Unsaved warning banner */}
            <div className="bg-amber-500 text-white rounded-xl px-5 py-3 mb-4 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">💾</span>
                <p className="text-sm font-medium">
                  <strong>This recipe hasn&apos;t been saved yet.</strong> Don&apos;t navigate away — hit &ldquo;Save Recipe&rdquo; below to keep it.
                </p>
              </div>
              <button
                onClick={handleSave}
                className="shrink-0 px-4 py-1.5 bg-white text-amber-700 font-semibold rounded-full text-sm hover:bg-amber-50 transition-colors"
              >
                Save now
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between gap-4">
              <button onClick={handleStartOver} className="text-stone-500 hover:text-stone-700 text-sm transition-colors">
                ← Start Over
              </button>
              <h2 className="text-stone-600 text-sm">Review your recipe before saving</h2>
            </div>

            {/* Editable title */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
              <label className="block text-xs text-stone-400 mb-1 font-medium uppercase tracking-wide">
                Recipe Name
              </label>
              <input
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="w-full text-xl font-serif font-bold text-stone-800 border-0 outline-none focus:ring-0 bg-transparent"
                placeholder="Recipe name..."
              />
            </div>

            {/* Quick preview */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-4 shadow-sm">
              <div className="grid md:grid-cols-5">
                <div className="md:col-span-2 bg-stone-50 p-5 border-r border-stone-100">
                  <h3 className="font-bold text-stone-700 mb-3 text-sm uppercase tracking-wide">
                    Ingredients ({generatedRecipe.ingredients.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {generatedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-amber-600 font-medium shrink-0">
                          {ing.amount} {ing.unit}
                        </span>
                        <span>{ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-3 p-5">
                  <h3 className="font-bold text-stone-700 mb-3 text-sm uppercase tracking-wide">
                    Steps ({generatedRecipe.instructions.length})
                  </h3>
                  <ol className="space-y-2">
                    {generatedRecipe.instructions.map((step, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-amber-600 font-bold shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {generatedRecipe.tips.length > 0 && (
                <div className="border-t border-amber-100 bg-amber-50 p-5">
                  <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                    <span>🤫</span> Secrets Captured ({generatedRecipe.tips.length})
                  </h3>
                  <div className="space-y-2">
                    {generatedRecipe.tips.map((tip, i) => (
                      <div key={i} className="text-sm text-stone-700 flex gap-2">
                        <span className="text-amber-600 font-medium capitalize shrink-0">{tip.category}:</span>
                        <span>{tip.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleStartOver}
                className="px-6 py-2.5 border border-stone-300 text-stone-600 rounded-full hover:bg-stone-100 transition-colors text-sm"
              >
                Try Again
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white font-semibold rounded-full transition-colors shadow-md"
              >
                {saving ? "Saving…" : "Save Recipe 💾"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

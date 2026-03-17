"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import VoiceCapture from "@/components/VoiceCapture";
import { saveRecipe, generateId } from "@/lib/storage";
import { Recipe, RecipeGenerationResult } from "@/lib/types";

type Stage = "capture" | "generating" | "preview";
type InputMode = "narrate" | "paste" | "url";

const UNSAVED_WARNING = "You have an unsaved recipe. If you leave now it will be lost — are you sure?";

const INPUT_MODES: { id: InputMode; icon: string; label: string }[] = [
  { id: "narrate", icon: "🎙", label: "Narrate" },
  { id: "paste",   icon: "📋", label: "Paste text" },
  { id: "url",     icon: "🔗", label: "From URL" },
];

const MODE_HINTS: Record<InputMode, { heading: string; body: string }> = {
  narrate: {
    heading: "Cook and talk",
    body: "Just narrate as you cook. Share the ingredients, the steps, but also how you know when something is ready, what to look for, what your mother always said. The more you share, the richer the recipe will be.",
  },
  paste: {
    heading: "Paste a written recipe",
    body: "Paste any recipe text — from an old document, a family notebook, a handwritten card you've typed up, or anywhere else. Claude will structure it and pull out any hidden tips or technique notes.",
  },
  url: {
    heading: "Import from a website",
    body: "Paste the URL of any publicly accessible recipe page. The page will be fetched and the recipe extracted automatically. If a site blocks access, use \"Paste text\" instead.",
  },
};

export default function CapturePage() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>("narrate");
  const [transcript, setTranscript] = useState("");   // narrate + paste share this
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<RecipeGenerationResult | null>(null);
  const [recipeName, setRecipeName] = useState("");

  // Warn on browser refresh / tab close when a recipe is unsaved
  useEffect(() => {
    if (stage !== "preview") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = UNSAVED_WARNING;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage]);

  // Guard for in-app navigation away from an unsaved preview
  const safeNavigate = useCallback((destination: string) => {
    if (stage === "preview") {
      if (!window.confirm(UNSAVED_WARNING)) return;
    }
    router.push(destination);
  }, [stage, router]);

  const handleNavBack = () => safeNavigate("/");

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setError(null);
  };

  /** Fetch a URL server-side and populate the paste textarea with the extracted text. */
  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setError(null);
    setUrlFetching(true);

    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Could not fetch that URL.");
        return;
      }
      // Hand the extracted text straight off to Claude
      await runGenerate(data.text, "url");
    } catch {
      setError("Network error fetching the URL. Please check your connection.");
    } finally {
      setUrlFetching(false);
    }
  };

  /** Call the generate-recipe API and transition to preview. */
  const runGenerate = async (content: string, source: string) => {
    setError(null);
    setStage("generating");
    try {
      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: content, source }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
        setStage("capture");
        return;
      }
      setGeneratedRecipe(data.recipe);
      setRecipeName(data.recipe.title);
      setStage("preview");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStage("capture");
    }
  };

  const handleGenerate = async () => {
    if (inputMode === "url") {
      await handleFetchUrl();
      return;
    }
    if (transcript.trim().length < 20) {
      setError(inputMode === "narrate"
        ? "Please narrate a bit more before generating — tell me about the dish!"
        : "Please paste some recipe text before generating.");
      return;
    }
    await runGenerate(transcript, inputMode === "narrate" ? "narration" : "text");
  };

  const handleSave = () => {
    if (!generatedRecipe) return;
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: generateId(),
      ...generatedRecipe,
      title: recipeName || generatedRecipe.title,
      createdAt: now,
      updatedAt: now,
    };
    saveRecipe(recipe);
    router.refresh();
    router.push(`/recipe/${recipe.id}`);
  };

  const handleStartOver = () => {
    if (stage === "preview") {
      if (!window.confirm(UNSAVED_WARNING)) return;
    }
    setStage("capture");
    setGeneratedRecipe(null);
    setError(null);
  };

  const canGenerate = inputMode === "url"
    ? urlInput.trim().length > 0
    : transcript.trim().length >= 20;

  const generateLabel = urlFetching ? "Fetching page..." : inputMode === "url" ? "Import Recipe ✨" : "Generate Recipe ✨";

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Nav */}
      <nav className="bg-amber-800 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={handleNavBack} className="text-amber-200 hover:text-white transition-colors text-sm">
          ← Recipe Box
        </button>
        <h1 className="font-serif text-xl font-bold">Capture a Recipe</h1>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {stage === "capture" && (
          <>
            {/* Input mode tabs */}
            <div className="flex gap-1 bg-stone-200 rounded-xl p-1 mb-6">
              {INPUT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(mode.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    inputMode === mode.id
                      ? "bg-white text-amber-800 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  <span>{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Context hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-amber-800 mb-1">{MODE_HINTS[inputMode].heading}</h2>
              <p className="text-amber-700 text-sm leading-relaxed">{MODE_HINTS[inputMode].body}</p>
            </div>

            {/* Input area */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-4">
              {inputMode === "narrate" && (
                <VoiceCapture transcript={transcript} onTranscriptChange={setTranscript} />
              )}

              {inputMode === "paste" && (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={`Paste your recipe here...\n\nWorks with anything: a URL you've copied text from, an old Word document, a scanned recipe you've typed up, or even a rough list of ingredients and steps.`}
                  className="w-full h-72 p-4 border-2 border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 text-stone-700 bg-amber-50 text-sm leading-relaxed"
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
                      placeholder="https://www.example.com/my-favourite-recipe"
                      className="flex-1 px-4 py-3 border-2 border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-stone-700 bg-amber-50 text-sm"
                    />
                  </div>
                  <p className="text-xs text-stone-400">
                    The page must be publicly accessible. If it&apos;s behind a login or paywall, copy and paste the text instead.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || urlFetching}
                className="px-8 py-3 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors shadow-md"
              >
                {generateLabel}
              </button>
            </div>
          </>
        )}

        {stage === "generating" && (
          <div className="text-center py-24">
            <div className="text-6xl mb-6 animate-bounce">🍳</div>
            <h2 className="text-2xl font-serif font-bold text-stone-700 mb-2">
              Reading between the lines...
            </h2>
            <p className="text-stone-500">
              Claude is finding the recipe, extracting the tips, tricks and secrets.
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
                className="px-8 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-full transition-colors shadow-md"
              >
                Save Recipe 💾
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

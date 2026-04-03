"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import { getRecipe, deleteRecipe, saveRecipe } from "@/lib/storage";
import { Recipe } from "@/lib/types";

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getRecipe(id).then((found) => {
      if (!found) setNotFound(true);
      else setRecipe(found);
    }).catch(() => setNotFound(true));
  }, [id]);

  const handleDelete = async () => {
    await deleteRecipe(id);
    router.push("/");
  };

  const handleSave = async (updated: Recipe) => {
    try {
      await saveRecipe(updated);
      setRecipe(updated);
      setSaveError(null);
    } catch {
      setSaveError("Something went wrong saving your changes. Please try again.");
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">🍽</p>
          <h2 className="text-xl font-bold text-stone-600 mb-2">Recipe not found</h2>
          <Link href="/" className="text-amber-700 hover:underline">
            Back to Recipe Library
          </Link>
        </div>
      </div>
    );
  }

  if (!recipe) return null;

  return (
    <div className="min-h-screen bg-stone-100">
      <nav className="bg-amber-800 text-white px-4 sm:px-6 pb-4 flex items-center gap-3" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <Link href="/" className="text-amber-200 hover:text-white transition-colors text-sm">
          ← Back
        </Link>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {saveError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span className="flex-1">{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <RecipeCard recipe={recipe} onDelete={handleDelete} onSave={handleSave} />
      </div>
    </div>
  );
}

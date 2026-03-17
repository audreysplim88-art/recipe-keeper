"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecipes } from "@/lib/storage";
import { Recipe } from "@/lib/types";

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const loadRecipes = () => setRecipes(getRecipes());

  useEffect(() => {
    loadRecipes();
    // Re-read localStorage whenever the user navigates back to this tab/page,
    // since Next.js router cache can restore the page without remounting.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadRecipes();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", loadRecipes);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", loadRecipes);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-amber-800 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-1">Recipe Box</h1>
            <p className="text-amber-200 text-sm">
              The recipes, tips and secrets that matter most
            </p>
          </div>
          <Link
            href="/capture"
            className="flex items-center gap-2 bg-white text-amber-800 font-semibold px-5 py-2.5 rounded-full hover:bg-amber-50 transition-colors shadow-md shrink-0"
          >
            <span>🎙</span> Capture a Recipe
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {recipes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="text-stone-500 text-sm mb-6">
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} saved
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <RecipeListCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function RecipeListCard({ recipe }: { recipe: Recipe }) {
  const tipCount = recipe.tips?.length ?? 0;

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group h-full flex flex-col">
        <h2 className="font-serif font-bold text-stone-800 text-lg mb-1 group-hover:text-amber-700 transition-colors line-clamp-2">
          {recipe.title}
        </h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-3 line-clamp-3 flex-1">
          {recipe.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-stone-100">
          <div className="flex items-center gap-3 text-xs text-stone-400">
            {recipe.ingredients?.length > 0 && (
              <span>🧄 {recipe.ingredients.length} ingredients</span>
            )}
            {tipCount > 0 && (
              <span className="text-amber-600 font-medium">🤫 {tipCount} secrets</span>
            )}
          </div>
          <span className="text-xs text-stone-400">
            {new Date(recipe.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="text-7xl mb-6">📖</div>
      <h2 className="text-2xl font-serif font-bold text-stone-600 mb-2">
        Your recipe box is empty
      </h2>
      <p className="text-stone-500 mb-8 max-w-sm mx-auto">
        Start narrating your first recipe. Talk through it as you cook — ingredients,
        steps, tips, secrets — and we&apos;ll turn it into something beautiful.
      </p>
      <Link
        href="/capture"
        className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-md"
      >
        <span>🎙</span> Capture Your First Recipe
      </Link>
    </div>
  );
}

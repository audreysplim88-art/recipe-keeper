"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getRecipes } from "@/lib/storage";
import { Recipe, RecipeCategory, CATEGORY_META, CATEGORY_ORDER } from "@/lib/types";

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");

  const loadRecipes = () => setRecipes(getRecipes());

  useEffect(() => {
    loadRecipes();
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

  // Filter across title, description, ingredients, tips, instructions, category
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) =>
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.ingredients?.some((i) => i.name?.toLowerCase().includes(q)) ||
      r.tips?.some((t) => t.content?.toLowerCase().includes(q)) ||
      r.instructions?.some((s) => s.toLowerCase().includes(q)) ||
      (r.category && CATEGORY_META[r.category]?.label.toLowerCase().includes(q))
    );
  }, [recipes, query]);

  // Group by category; recipes without a category fall into "other"
  const byCategory = useMemo(() => {
    const map = new Map<RecipeCategory, Recipe[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const recipe of filtered) {
      const cat: RecipeCategory = recipe.category ?? "other";
      map.get(cat)!.push(recipe);
    }
    return map;
  }, [filtered]);

  const isSearching = query.trim().length > 0;

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

        {/* Search bar — only shown once there are recipes */}
        {recipes.length > 0 && (
          <div className="max-w-5xl mx-auto mt-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-sm">
                🔍
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes, ingredients, tips…"
                className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/95 text-stone-800 placeholder-stone-400 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xl leading-none"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {recipes.length === 0 ? (
          <EmptyState />
        ) : isSearching ? (
          <SearchResults recipes={filtered} query={query} />
        ) : (
          <CategorySections byCategory={byCategory} totalCount={recipes.length} />
        )}
      </main>
    </div>
  );
}

/* ── Search results ─────────────────────────────────────────── */
function SearchResults({ recipes, query }: { recipes: Recipe[]; query: string }) {
  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-serif font-bold text-stone-600 mb-2">
          No recipes found for &ldquo;{query}&rdquo;
        </h2>
        <p className="text-stone-400 text-sm">Try a different keyword or ingredient name</p>
      </div>
    );
  }
  return (
    <>
      <p className="text-stone-500 text-sm mb-6">
        {recipes.length} {recipes.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((r) => <RecipeListCard key={r.id} recipe={r} />)}
      </div>
    </>
  );
}

/* ── Category sections ──────────────────────────────────────── */
function CategorySections({
  byCategory,
  totalCount,
}: {
  byCategory: Map<RecipeCategory, Recipe[]>;
  totalCount: number;
}) {
  const activeSections = CATEGORY_ORDER.filter(
    (cat) => (byCategory.get(cat)?.length ?? 0) > 0
  );

  return (
    <>
      <p className="text-stone-500 text-sm mb-8">
        {totalCount} {totalCount === 1 ? "recipe" : "recipes"} saved
      </p>
      <div className="space-y-10">
        {activeSections.map((cat) => {
          const sectionRecipes = byCategory.get(cat)!;
          const { label, emoji } = CATEGORY_META[cat];
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl" role="img" aria-label={label}>{emoji}</span>
                <h2 className="text-xl font-serif font-bold text-stone-700">{label}</h2>
                <span className="text-stone-400 text-sm">({sectionRecipes.length})</span>
                <div className="flex-1 h-px bg-stone-200 ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sectionRecipes.map((r) => <RecipeListCard key={r.id} recipe={r} />)}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ── Recipe card ────────────────────────────────────────────── */
function RecipeListCard({ recipe }: { recipe: Recipe }) {
  const tipCount = recipe.tips?.length ?? 0;
  const meta = recipe.category ? CATEGORY_META[recipe.category] : null;

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group h-full flex flex-col">
        {meta && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5 mb-2 self-start">
            {meta.emoji} {meta.label}
          </span>
        )}
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

/* ── Empty state ────────────────────────────────────────────── */
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

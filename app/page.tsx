"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getRecipes, saveRecipe } from "@/lib/storage";
import { Recipe, RecipeCategory, CATEGORY_META, CATEGORY_ORDER, DIETARY_META } from "@/lib/types";
import { BACKFILL_REQUEST_DELAY_MS } from "@/lib/constants";

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
      const cat: RecipeCategory = recipe.category;
      map.get(cat)!.push(recipe);
    }
    return map;
  }, [filtered]);

  const isSearching = query.trim().length > 0;

  // Backfill: recipes that have no dietary or allergen data yet
  const untaggedRecipes = useMemo(
    () => recipes.filter((r) => r.dietaryTags === undefined && r.allergens === undefined),
    [recipes]
  );

  type BackfillState = { total: number; done: number; errors: number; running: boolean };
  const [backfill, setBackfill] = useState<BackfillState | null>(null);

  // Ref-based guard: prevents a second concurrent backfill run if the user
  // clicks "Auto-detect now" before React has hidden the button after the first
  // click. A ref is used (not state) to avoid an unnecessary re-render.
  const backfillRunningRef = useRef(false);

  const runBackfill = async () => {
    if (backfillRunningRef.current) return;

    const toProcess = getRecipes().filter(
      (r) => r.dietaryTags === undefined && r.allergens === undefined
    );
    if (toProcess.length === 0) return;

    backfillRunningRef.current = true;
    setBackfill({ total: toProcess.length, done: 0, errors: 0, running: true });

    for (let i = 0; i < toProcess.length; i++) {
      const recipe = toProcess[i];
      try {
        const res = await fetch("/api/classify-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
          }),
        });
        if (res.ok) {
          const { dietaryTags, allergens } = await res.json();
          saveRecipe({ ...recipe, dietaryTags: dietaryTags ?? [], allergens: allergens ?? [] });
          setBackfill((prev) => prev && ({ ...prev, done: prev.done + 1 }));
        } else {
          setBackfill((prev) => prev && ({ ...prev, done: prev.done + 1, errors: prev.errors + 1 }));
        }
      } catch {
        setBackfill((prev) => prev && ({ ...prev, done: prev.done + 1, errors: prev.errors + 1 }));
      }

      // Rate-limit: pause between requests to avoid hitting API limits.
      // Skip the delay after the last item so the run finishes promptly.
      if (i < toProcess.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, BACKFILL_REQUEST_DELAY_MS));
      }
    }

    backfillRunningRef.current = false;
    setBackfill((prev) => prev && ({ ...prev, running: false }));
    loadRecipes(); // refresh the list
  };

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
        {/* Backfill banner */}
        {!isSearching && recipes.length > 0 && (backfill !== null || untaggedRecipes.length > 0) && (
          <div className={`mb-6 rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
            backfill?.running
              ? "bg-amber-50 border-amber-200"
              : backfill && !backfill.running
              ? backfill.errors === 0
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            {backfill?.running ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="animate-spin text-lg">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Detecting allergens & dietary info…
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {backfill.done} of {backfill.total} recipes processed
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-32 bg-amber-200 rounded-full h-2 shrink-0">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all"
                    style={{ width: `${(backfill.done / backfill.total) * 100}%` }}
                  />
                </div>
              </>
            ) : backfill && !backfill.running ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{backfill.errors === 0 ? "✅" : "⚠️"}</span>
                  <p className="text-sm font-semibold text-stone-700">
                    {backfill.errors === 0
                      ? `All ${backfill.total} recipes updated with allergen & dietary info`
                      : `${backfill.done - backfill.errors} of ${backfill.total} recipes updated (${backfill.errors} failed)`}
                  </p>
                </div>
                <button
                  onClick={() => setBackfill(null)}
                  className="text-stone-400 hover:text-stone-600 text-lg leading-none shrink-0"
                  aria-label="Dismiss"
                >×</button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {untaggedRecipes.length} {untaggedRecipes.length === 1 ? "recipe is" : "recipes are"} missing allergen & dietary info
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Run auto-detection to tag your existing recipes
                  </p>
                </div>
                <button
                  onClick={runBackfill}
                  className="shrink-0 flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
                >
                  ✨ Auto-detect now
                </button>
              </>
            )}
          </div>
        )}

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
  const tipCount = recipe.tips.length;
  const meta = CATEGORY_META[recipe.category];
  const dietaryTags = recipe.dietaryTags;
  const allergenCount = recipe.allergens.length;

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group h-full flex flex-col">
        {/* Category + dietary row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {meta ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5">
              {meta.emoji} {meta.label}
            </span>
          ) : <span />}
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {dietaryTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                title={DIETARY_META[tag].label}
                className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded border leading-none bg-green-50 text-green-700 border-green-200"
              >
                {DIETARY_META[tag].symbol}
              </span>
            ))}
            {allergenCount > 0 && (
              <span
                className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded border leading-none bg-amber-50 text-amber-700 border-amber-200"
                title={`Contains ${allergenCount} allergen${allergenCount > 1 ? "s" : ""}`}
              >
                ⚠ {allergenCount}
              </span>
            )}
          </div>
        </div>

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

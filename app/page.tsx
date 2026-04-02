"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRecipes, saveRecipe } from "@/lib/storage";
import { Recipe, RecipeCategory, CATEGORY_META, CATEGORY_ORDER, DIETARY_META } from "@/lib/types";
import { BACKFILL_REQUEST_DELAY_MS } from "@/lib/constants";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  getLocalRecipes,
  migrateLocalRecipes,
  MIGRATION_DISMISSED_KEY,
} from "@/lib/migration";

/* ── User menu ──────────────────────────────────────────────── */
function UserMenu() {
  const { profile } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const initials = profile?.first_name ? profile.first_name[0].toUpperCase() : "?";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-colors border border-white/30"
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-11 z-20 bg-white rounded-xl shadow-lg border border-stone-200 min-w-[160px] py-1 overflow-hidden">
            {profile?.first_name && (
              <p className="px-4 py-2 text-xs text-stone-400 border-b border-stone-100">
                Hi, {profile.first_name} 👋
              </p>
            )}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Account
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors border-t border-stone-100"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<RecipeCategory | null>(null);

  // ── Migration banner ──────────────────────────────────────────────────────
  // Shown once if the user has pre-auth recipes in localStorage that haven't
  // been imported yet.
  const [localRecipeCount, setLocalRecipeCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(MIGRATION_DISMISSED_KEY);
    if (dismissed) return;
    const local = getLocalRecipes();
    if (local.length > 0) setLocalRecipeCount(local.length);
  }, [user]);

  const handleMigrate = useCallback(async () => {
    setMigrating(true);
    setMigrationError(null);
    try {
      const { migrated, errors } = await migrateLocalRecipes();
      if (errors > 0 && migrated === 0) {
        // Total failure — keep the banner open so the user can retry
        setMigrationError(
          "Import failed. Make sure you're connected and try again. Your recipes are still safely on this device."
        );
      } else if (errors > 0) {
        // Partial — some saved, some didn't
        setMigrationError(
          `${migrated} imported, ${errors} failed. Your remaining recipes are still on this device — try again when connected.`
        );
        setLocalRecipeCount(errors);
      } else {
        // Full success
        setLocalRecipeCount(0);
        setMigrationDone(true);
      }
    } catch {
      setMigrationError("Something went wrong. Your recipes are still safely on this device — please try again.");
    } finally {
      setMigrating(false);
      // Reload from Supabase so any successfully migrated recipes appear
      try {
        setRecipes(await getRecipes());
      } catch {
        // Ignore fetch errors — recipes already loaded
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismissMigration = useCallback(() => {
    localStorage.setItem(MIGRATION_DISMISSED_KEY, "true");
    setLocalRecipeCount(0);
  }, []);

  // ── Recipe loading ────────────────────────────────────────────────────────
  const loadRecipes = useCallback(async () => {
    try {
      const data = await getRecipes();
      setRecipes(data);
    } catch {
      // Silently ignore — user may have lost connection
    } finally {
      setRecipesLoading(false);
    }
  }, []);

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
  }, [loadRecipes]);

  // Filter across title, description, ingredients, tips, instructions, category
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(q)) ||
      r.tips.some((t) => t.content.toLowerCase().includes(q)) ||
      r.instructions.some((s) => s.toLowerCase().includes(q)) ||
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

    const toProcess = (await getRecipes()).filter(
      (r) => r.dietaryTags === undefined && r.allergens === undefined
    );
    if (toProcess.length === 0) return;

    backfillRunningRef.current = true;
    setBackfill({ total: toProcess.length, done: 0, errors: 0, running: true });

    for (let i = 0; i < toProcess.length; i++) {
      const recipe = toProcess[i];
      try {
        const res = await fetch(`${API_BASE}/api/classify-recipe`, {
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
          await saveRecipe({ ...recipe, dietaryTags: dietaryTags ?? [], allergens: allergens ?? [] });
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
    await loadRecipes(); // refresh the list
  };

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-amber-800 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-1">Dodol.</h1>
            <p className="text-amber-200 text-sm">
              Your favourite recipes and chef tips and tricks, all in one place
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/capture"
              className="flex items-center gap-2 bg-white text-amber-800 font-semibold px-5 py-2.5 rounded-full hover:bg-amber-50 transition-colors shadow-md shrink-0"
            >
              + New Recipe
            </Link>
            <UserMenu />
          </div>
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

        {/* Migration banner */}
        {localRecipeCount > 0 && (
          <div className={`mb-6 rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
            migrationError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
          }`}>
            <div>
              {migrationError ? (
                <>
                  <p className="text-sm font-semibold text-red-800">⚠️ Import issue</p>
                  <p className="text-xs text-red-600 mt-0.5">{migrationError}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-800">
                    📦 You have {localRecipeCount} {localRecipeCount === 1 ? "recipe" : "recipes"} saved on this device
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Import {localRecipeCount === 1 ? "it" : "them"} to your account to access from any device
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
              >
                {migrating ? "Importing…" : migrationError ? "Retry" : "Import"}
              </button>
              <button
                onClick={handleDismissMigration}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Migration success */}
        {migrationDone && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-green-800">
              ✅ Recipes imported successfully — they&apos;re now saved to your account
            </p>
            <button
              onClick={() => setMigrationDone(false)}
              className="text-stone-400 hover:text-stone-600 text-lg leading-none shrink-0"
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* Category filter pills */}
        {recipes.length > 0 && !query && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilterCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategory === null
                  ? "bg-amber-700 text-white"
                  : "border border-stone-300 text-stone-600 hover:border-amber-400 hover:text-amber-700"
              }`}
            >
              All
            </button>
            {CATEGORY_ORDER.filter((cat) => (byCategory.get(cat)?.length ?? 0) > 0).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterCategory === cat
                    ? "bg-amber-700 text-white"
                    : "border border-stone-300 text-stone-600 hover:border-amber-400 hover:text-amber-700"
                }`}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        )}

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

        {recipesLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 h-36 animate-pulse">
                <div className="h-3 bg-stone-100 rounded w-1/3 mb-3" />
                <div className="h-5 bg-stone-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState />
        ) : isSearching ? (
          <SearchResults recipes={filtered} query={query} />
        ) : (
          <CategorySections byCategory={byCategory} totalCount={recipes.length} filterCategory={filterCategory} />
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
  filterCategory,
}: {
  byCategory: Map<RecipeCategory, Recipe[]>;
  totalCount: number;
  filterCategory: RecipeCategory | null;
}) {
  const activeSections = CATEGORY_ORDER.filter(
    (cat) => (byCategory.get(cat)?.length ?? 0) > 0 && (filterCategory === null || cat === filterCategory)
  );

  return (
    <>
      <p className="text-stone-500 text-sm mb-8">
        {totalCount} {totalCount === 1 ? "recipe" : "recipes"} saved
      </p>
      <div className="space-y-10">
        {activeSections.map((cat) => {
          const sectionRecipes = byCategory.get(cat)!;
          const { label } = CATEGORY_META[cat];
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-4">
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
  const meta = CATEGORY_META[recipe.category];
  const dietaryTags = recipe.dietaryTags ?? [];
  const allergenCount = (recipe.allergens ?? []).length;

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group h-full flex flex-col">
        {/* Category + dietary row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {meta ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5">
              {meta.label}
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

        <h2 className="font-serif font-bold text-stone-800 text-lg mb-3 group-hover:text-amber-700 transition-colors line-clamp-2">
          {recipe.title}
        </h2>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-stone-100">
          <div className="flex items-center gap-3 text-xs text-stone-400">
            {recipe.ingredients?.length > 0 && (
              <span>{recipe.ingredients.length} ingredients</span>
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
      <h2 className="text-2xl font-serif font-bold text-stone-600 mb-2">
        Your recipe library is empty
      </h2>
      <p className="text-stone-500 mb-8 max-w-md mx-auto">
        Start adding your first recipe! You have the option to talk through one with me,
        copy and paste an existing recipe, share a URL or take a photo of a page in a
        recipe book. I&apos;ll then turn them into fancy recipe cards! Don&apos;t forget to
        include your tips, tricks and secrets — I capture those especially well!
      </p>
      <Link
        href="/capture"
        className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-md"
      >
        Capture Your First Recipe
      </Link>
    </div>
  );
}

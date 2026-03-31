import { createClient } from "./supabase/client";
import { Recipe, RecipeCategory, DietaryTag, AllergenTag } from "./types";

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Kept for backwards compatibility — callers that catch StorageQuotaError
 * will still compile. With Supabase storage this is no longer thrown.
 */
export class StorageQuotaError extends Error {
  constructor() {
    super("Your recipe collection has run out of storage space.");
    this.name = "StorageQuotaError";
  }
}

// ─── Row ↔ Recipe mapping ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecipe(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category as RecipeCategory,
    dietaryTags: (row.dietary_tags ?? []) as DietaryTag[],
    allergens: (row.allergens ?? []) as AllergenTag[],
    servings: row.servings ?? "",
    prepTime: row.prep_time ?? "",
    cookTime: row.cook_time ?? "",
    ingredients: row.ingredients ?? [],
    instructions: row.instructions ?? [],
    tips: row.tips ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipeToRow(recipe: Recipe, userId: string) {
  return {
    id: recipe.id,
    user_id: userId,
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    dietary_tags: recipe.dietaryTags,
    allergens: recipe.allergens,
    servings: recipe.servings,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    tips: recipe.tips,
    created_at: recipe.createdAt,
    updated_at: recipe.updatedAt,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch all recipes for the signed-in user, newest first. */
export async function getRecipes(): Promise<Recipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

/** Fetch a single recipe by id. Returns null if not found. */
export async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecipe(data) : null;
}

/**
 * Insert or update a recipe.
 * @throws if the user is not authenticated or Supabase returns an error.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("recipes")
    .upsert(recipeToRow(recipe, user.id), { onConflict: "id" });
  if (error) throw error;
}

/** Remove a recipe by id. No-op if it doesn't exist. */
export async function deleteRecipe(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

/** Generate a unique recipe id. */
export function generateId(): string {
  return `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

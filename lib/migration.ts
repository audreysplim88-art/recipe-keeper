/**
 * localStorage → Supabase migration helpers.
 *
 * When a user first signs in on a device that has pre-auth recipes in
 * localStorage, we offer a one-time import. This module handles reading
 * those recipes, upserting them to Supabase, and clearing localStorage.
 */

import { Recipe } from "./types";
import { saveRecipe } from "./storage";

const LOCAL_STORAGE_KEY = "recipe-keeper-recipes";

/** Key used to remember that the user dismissed the migration banner. */
export const MIGRATION_DISMISSED_KEY = "recipe-keeper-migration-dismissed";

/** Read pre-auth recipes that are still sitting in localStorage. */
export function getLocalRecipes(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? (JSON.parse(data) as Recipe[]) : [];
  } catch {
    return [];
  }
}

/** Remove the legacy localStorage recipe store. */
export function clearLocalRecipes(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Upsert every localStorage recipe into Supabase, then clear localStorage.
 *
 * @returns counts of successfully migrated and failed recipes.
 */
export async function migrateLocalRecipes(): Promise<{
  migrated: number;
  errors: number;
}> {
  const recipes = getLocalRecipes();
  let migrated = 0;
  let errors = 0;

  for (const recipe of recipes) {
    try {
      await saveRecipe(recipe);
      migrated++;
    } catch {
      errors++;
    }
  }

  // Only clear localStorage once every recipe has been saved successfully.
  // If any failed we keep localStorage intact so the user doesn't lose data.
  if (errors === 0) {
    clearLocalRecipes();
  }

  return { migrated, errors };
}

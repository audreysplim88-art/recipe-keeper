import { Recipe } from "./types";

const STORAGE_KEY = "recipe-keeper-recipes";

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Thrown by saveRecipe (and deleteRecipe) when the browser's localStorage
 * quota is exhausted. Callers should catch this and show a user-facing message
 * rather than letting the save fail silently.
 */
export class StorageQuotaError extends Error {
  constructor() {
    super(
      "Your recipe collection has run out of storage space. " +
        "Please delete a few recipes to make room."
    );
    this.name = "StorageQuotaError";
  }
}

/** Returns true for every browser/OS variant of a localStorage quota error. */
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Chrome/Safari/Edge: DOMException name "QuotaExceededError"
  // Firefox:            DOMException name "NS_ERROR_DOM_QUOTA_REACHED"
  // Legacy iOS:         DOMException code 22
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    (err instanceof DOMException && err.code === 22)
  );
}

/** Calls localStorage.setItem and converts any quota error into StorageQuotaError. */
function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (isQuotaError(err)) throw new StorageQuotaError();
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getRecipes(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getRecipe(id: string): Recipe | null {
  const recipes = getRecipes();
  return recipes.find((r) => r.id === id) ?? null;
}

/**
 * Persists a recipe (insert or update).
 * @throws {StorageQuotaError} when the browser's localStorage quota is full.
 */
export function saveRecipe(recipe: Recipe): void {
  const recipes = getRecipes();
  const existingIndex = recipes.findIndex((r) => r.id === recipe.id);
  if (existingIndex >= 0) {
    recipes[existingIndex] = recipe;
  } else {
    recipes.unshift(recipe);
  }
  setItem(STORAGE_KEY, JSON.stringify(recipes));
}

/**
 * Removes a recipe by id. No-op if the id does not exist.
 * @throws {StorageQuotaError} when the browser's localStorage quota is full
 *   (unlikely on delete, but possible in edge cases).
 */
export function deleteRecipe(id: string): void {
  const recipes = getRecipes().filter((r) => r.id !== id);
  setItem(STORAGE_KEY, JSON.stringify(recipes));
}

export function generateId(): string {
  return `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

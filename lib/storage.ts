import { Recipe } from "./types";

const STORAGE_KEY = "recipe-keeper-recipes";

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

export function saveRecipe(recipe: Recipe): void {
  const recipes = getRecipes();
  const existingIndex = recipes.findIndex((r) => r.id === recipe.id);
  if (existingIndex >= 0) {
    recipes[existingIndex] = recipe;
  } else {
    recipes.unshift(recipe);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

export function deleteRecipe(id: string): void {
  const recipes = getRecipes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

export function generateId(): string {
  return `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

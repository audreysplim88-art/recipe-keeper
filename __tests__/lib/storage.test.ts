/**
 * Tests for lib/storage.ts
 *
 * localStorage is provided by jsdom and reset between tests.
 */

import { getRecipes, getRecipe, saveRecipe, deleteRecipe, generateId } from "@/lib/storage";
import { Recipe } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "test-1",
    title: "Test Recipe",
    description: "A test",
    servings: "2 servings",
    prepTime: "10 minutes",
    cookTime: "20 minutes",
    ingredients: [],
    instructions: [],
    tips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ─── getRecipes ───────────────────────────────────────────────────────────────

describe("getRecipes", () => {
  it("returns an empty array when storage is empty", () => {
    expect(getRecipes()).toEqual([]);
  });

  it("returns stored recipes", () => {
    const recipe = makeRecipe();
    saveRecipe(recipe);
    expect(getRecipes()).toHaveLength(1);
    expect(getRecipes()[0].id).toBe("test-1");
  });

  it("returns an empty array when storage contains invalid JSON", () => {
    localStorage.setItem("recipe-keeper-recipes", "not-valid-json");
    expect(getRecipes()).toEqual([]);
  });
});

// ─── getRecipe ────────────────────────────────────────────────────────────────

describe("getRecipe", () => {
  it("returns a recipe by id", () => {
    saveRecipe(makeRecipe({ id: "abc" }));
    expect(getRecipe("abc")?.id).toBe("abc");
  });

  it("returns null for a missing id", () => {
    expect(getRecipe("does-not-exist")).toBeNull();
  });
});

// ─── saveRecipe ───────────────────────────────────────────────────────────────

describe("saveRecipe", () => {
  it("adds a new recipe to storage", () => {
    saveRecipe(makeRecipe({ id: "r1" }));
    expect(getRecipes()).toHaveLength(1);
  });

  it("prepends new recipes so newest appears first", () => {
    saveRecipe(makeRecipe({ id: "old" }));
    saveRecipe(makeRecipe({ id: "new" }));
    expect(getRecipes()[0].id).toBe("new");
  });

  it("updates an existing recipe in place without duplicating", () => {
    saveRecipe(makeRecipe({ id: "r1", title: "Original" }));
    saveRecipe(makeRecipe({ id: "r1", title: "Updated" }));
    const all = getRecipes();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Updated");
  });

  it("persists dietaryTags and allergens", () => {
    saveRecipe(makeRecipe({ id: "r1", dietaryTags: ["vegan"], allergens: ["gluten"] }));
    const saved = getRecipe("r1");
    expect(saved?.dietaryTags).toEqual(["vegan"]);
    expect(saved?.allergens).toEqual(["gluten"]);
  });
});

// ─── deleteRecipe ─────────────────────────────────────────────────────────────

describe("deleteRecipe", () => {
  it("removes the recipe with the given id", () => {
    saveRecipe(makeRecipe({ id: "to-delete" }));
    deleteRecipe("to-delete");
    expect(getRecipe("to-delete")).toBeNull();
  });

  it("does not affect other recipes", () => {
    saveRecipe(makeRecipe({ id: "keep" }));
    saveRecipe(makeRecipe({ id: "remove" }));
    deleteRecipe("remove");
    expect(getRecipes()).toHaveLength(1);
    expect(getRecipes()[0].id).toBe("keep");
  });

  it("does nothing when id does not exist", () => {
    saveRecipe(makeRecipe({ id: "r1" }));
    deleteRecipe("ghost");
    expect(getRecipes()).toHaveLength(1);
  });
});

// ─── generateId ───────────────────────────────────────────────────────────────

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("returns unique ids on repeated calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });

  it("starts with the recipe- prefix", () => {
    expect(generateId().startsWith("recipe-")).toBe(true);
  });
});

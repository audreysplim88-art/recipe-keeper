/**
 * Tests for lib/storage.ts
 *
 * Supabase is mocked — no real network calls are made.
 */

import { getRecipes, getRecipe, saveRecipe, deleteRecipe, generateId, StorageQuotaError } from "@/lib/storage";
import { Recipe } from "@/lib/types";

// ─── Supabase mock ────────────────────────────────────────────────────────────

// We build a minimal fluent-builder mock that mirrors the Supabase JS client's
// query builder pattern: from().select().order() / from().upsert() / etc.

type MockBuilder = {
  select: jest.Mock;
  order: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
};

let mockBuilder: MockBuilder;
let mockGetUser: jest.Mock;

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@/lib/supabase/client") as { createClient: jest.Mock };

beforeEach(() => {
  // Reset fresh builder mocks before each test so state never bleeds across.
  mockGetUser = jest.fn();

  mockBuilder = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    delete: jest.fn().mockReturnThis(),
  };

  // Make delete().eq() resolve
  mockBuilder.delete.mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  createClient.mockReturnValue({
    from: jest.fn().mockReturnValue(mockBuilder),
    auth: { getUser: mockGetUser },
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "test-1",
    title: "Test Recipe",
    description: "A test",
    category: "other",
    dietaryTags: [],
    allergens: [],
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

function dbRow(recipe: Recipe) {
  return {
    id: recipe.id,
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

// ─── getRecipes ───────────────────────────────────────────────────────────────

describe("getRecipes", () => {
  it("returns an empty array when Supabase returns no rows", async () => {
    mockBuilder.order.mockResolvedValue({ data: [], error: null });
    await expect(getRecipes()).resolves.toEqual([]);
  });

  it("maps DB rows to Recipe objects", async () => {
    const recipe = makeRecipe({ id: "r1" });
    mockBuilder.order.mockResolvedValue({ data: [dbRow(recipe)], error: null });
    const result = await getRecipes();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
    expect(result[0].dietaryTags).toEqual([]);
  });

  it("throws when Supabase returns an error", async () => {
    mockBuilder.order.mockResolvedValue({ data: null, error: new Error("db error") });
    await expect(getRecipes()).rejects.toThrow("db error");
  });
});

// ─── getRecipe ────────────────────────────────────────────────────────────────

describe("getRecipe", () => {
  it("returns a recipe when found", async () => {
    const recipe = makeRecipe({ id: "abc" });
    mockBuilder.maybeSingle.mockResolvedValue({ data: dbRow(recipe), error: null });
    const result = await getRecipe("abc");
    expect(result?.id).toBe("abc");
  });

  it("returns null when not found", async () => {
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getRecipe("missing")).resolves.toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: new Error("not found") });
    await expect(getRecipe("x")).rejects.toThrow("not found");
  });
});

// ─── saveRecipe ───────────────────────────────────────────────────────────────

describe("saveRecipe", () => {
  it("calls upsert with the correct row", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const recipe = makeRecipe({ id: "r1" });
    await saveRecipe(recipe);
    expect(mockBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", user_id: "user-1" }),
      expect.anything()
    );
  });

  it("throws when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(saveRecipe(makeRecipe())).rejects.toThrow("Not authenticated");
  });

  it("throws when Supabase returns an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockBuilder.upsert.mockResolvedValue({ error: new Error("upsert failed") });
    await expect(saveRecipe(makeRecipe())).rejects.toThrow("upsert failed");
  });
});

// ─── deleteRecipe ─────────────────────────────────────────────────────────────

describe("deleteRecipe", () => {
  it("calls delete with the correct id", async () => {
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    mockBuilder.delete.mockReturnValue({ eq: mockEq });

    await deleteRecipe("r1");
    expect(mockEq).toHaveBeenCalledWith("id", "r1");
  });

  it("throws when Supabase returns an error", async () => {
    const mockEq = jest.fn().mockResolvedValue({ error: new Error("delete failed") });
    mockBuilder.delete.mockReturnValue({ eq: mockEq });

    await expect(deleteRecipe("r1")).rejects.toThrow("delete failed");
  });
});

// ─── StorageQuotaError ────────────────────────────────────────────────────────

describe("StorageQuotaError", () => {
  it("has the expected name and a non-empty message", () => {
    const err = new StorageQuotaError();
    expect(err.name).toBe("StorageQuotaError");
    expect(err.message.length).toBeGreaterThan(0);
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

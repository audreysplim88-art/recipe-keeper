export type RecipeCategory =
  | "starters"
  | "mains"
  | "desserts"
  | "sides"
  | "soups-salads"
  | "breakfast"
  | "snacks"
  | "drinks"
  | "sauces"
  | "other";

export const CATEGORY_META: Record<RecipeCategory, { label: string; emoji: string }> = {
  starters:        { label: "Starters & Appetisers", emoji: "🥗" },
  mains:           { label: "Mains",                 emoji: "🍽️" },
  desserts:        { label: "Desserts",               emoji: "🍰" },
  sides:           { label: "Sides",                  emoji: "🥦" },
  "soups-salads":  { label: "Soups & Salads",         emoji: "🥣" },
  breakfast:       { label: "Breakfast & Brunch",     emoji: "🍳" },
  snacks:          { label: "Snacks",                 emoji: "🧁" },
  drinks:          { label: "Drinks",                 emoji: "🍹" },
  sauces:          { label: "Sauces & Condiments",    emoji: "🫙" },
  other:           { label: "Other",                  emoji: "📚" },
};

export const CATEGORY_ORDER: RecipeCategory[] = [
  "starters", "mains", "desserts", "sides", "soups-salads",
  "breakfast", "snacks", "drinks", "sauces", "other",
];

// ─── Dietary tags ────────────────────────────────────────────────────────────

export type DietaryTag = "vegan" | "vegetarian" | "gluten-free" | "dairy-free" | "nut-free";

export const DIETARY_META: Record<DietaryTag, { label: string; emoji: string }> = {
  vegan:        { label: "Vegan",        emoji: "🌱" },
  vegetarian:   { label: "Vegetarian",   emoji: "🥗" },
  "gluten-free":{ label: "Gluten-free",  emoji: "🌾" },
  "dairy-free": { label: "Dairy-free",   emoji: "🥛" },
  "nut-free":   { label: "Nut-free",     emoji: "🥜" },
};

export const DIETARY_ORDER: DietaryTag[] = [
  "vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free",
];

// ─── Allergen tags (EU/UK Big 14) ────────────────────────────────────────────

export type AllergenTag =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts"
  | "soy" | "dairy" | "tree-nuts" | "celery" | "mustard"
  | "sesame" | "sulphites" | "lupin" | "molluscs";

export const ALLERGEN_META: Record<AllergenTag, { label: string; emoji: string }> = {
  gluten:       { label: "Gluten",       emoji: "🌾" },
  crustaceans:  { label: "Crustaceans",  emoji: "🦐" },
  eggs:         { label: "Eggs",         emoji: "🥚" },
  fish:         { label: "Fish",         emoji: "🐟" },
  peanuts:      { label: "Peanuts",      emoji: "🥜" },
  soy:          { label: "Soy",          emoji: "🫘" },
  dairy:        { label: "Dairy",        emoji: "🥛" },
  "tree-nuts":  { label: "Tree nuts",    emoji: "🌰" },
  celery:       { label: "Celery",       emoji: "🥬" },
  mustard:      { label: "Mustard",      emoji: "🟡" },
  sesame:       { label: "Sesame",       emoji: "🫚" },
  sulphites:    { label: "Sulphites",    emoji: "🍷" },
  lupin:        { label: "Lupin",        emoji: "🌼" },
  molluscs:     { label: "Molluscs",     emoji: "🦪" },
};

export const ALLERGEN_ORDER: AllergenTag[] = [
  "gluten", "crustaceans", "eggs", "fish", "peanuts", "soy", "dairy",
  "tree-nuts", "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs",
];

// ─── Recipe ──────────────────────────────────────────────────────────────────

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category?: RecipeCategory;
  dietaryTags?: DietaryTag[];
  allergens?: AllergenTag[];
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: Ingredient[];
  instructions: string[];
  tips: Tip[];
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  notes?: string;
}

export interface Tip {
  category: "tip" | "trick" | "secret" | "note";
  content: string;
}

export interface RecipeGenerationResult {
  title: string;
  description: string;
  category: RecipeCategory;
  dietaryTags: DietaryTag[];
  allergens: AllergenTag[];
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: Ingredient[];
  instructions: string[];
  tips: Tip[];
}

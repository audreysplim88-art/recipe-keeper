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

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category?: RecipeCategory;
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
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: Ingredient[];
  instructions: string[];
  tips: Tip[];
}

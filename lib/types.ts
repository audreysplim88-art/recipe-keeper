export interface Recipe {
  id: string;
  title: string;
  description: string;
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
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: Ingredient[];
  instructions: string[];
  tips: Tip[];
}

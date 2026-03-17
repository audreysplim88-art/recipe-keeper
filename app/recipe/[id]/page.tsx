"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import { getRecipe, deleteRecipe, saveRecipe } from "@/lib/storage";
import { Recipe } from "@/lib/types";

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const found = getRecipe(id);
    if (!found) {
      setNotFound(true);
    } else {
      setRecipe(found);
    }
  }, [id]);

  const handleDelete = () => {
    deleteRecipe(id);
    router.push("/");
  };

  const handleSave = (updated: Recipe) => {
    saveRecipe(updated);
    setRecipe(updated);
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">🍽</p>
          <h2 className="text-xl font-bold text-stone-600 mb-2">Recipe not found</h2>
          <Link href="/" className="text-amber-700 hover:underline">
            Back to Recipe Box
          </Link>
        </div>
      </div>
    );
  }

  if (!recipe) return null;

  return (
    <div className="min-h-screen bg-stone-100">
      <nav className="bg-amber-800 text-white px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-amber-200 hover:text-white transition-colors text-sm">
          ← Recipe Box
        </Link>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <RecipeCard recipe={recipe} onDelete={handleDelete} onSave={handleSave} />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRecipe } from "@/lib/storage";
import { Recipe } from "@/lib/types";
import SousChefSession from "@/components/SousChefSession";

export default function CookPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (!id) {
      setRecipe(null);
      return;
    }
    getRecipe(id).then(setRecipe).catch(() => setRecipe(null));
  }, [id]);

  // Loading
  if (recipe === undefined) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not found
  if (recipe === null) {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-2xl font-bold text-gray-300">Recipe not found</p>
        <p className="text-gray-500 text-sm">This recipe may have been deleted.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
        >
          Back to recipes
        </button>
      </div>
    );
  }

  return (
    <SousChefSession
      recipe={recipe}
      onExit={() => router.push(`/recipe/${recipe.id}`)}
    />
  );
}

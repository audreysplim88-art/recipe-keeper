/**
 * Subscription and recipe-count helpers.
 *
 * All functions use the browser Supabase client and are safe to call
 * from Client Components.
 */

import { createClient } from "./supabase/client";
import { FREE_RECIPE_LIMIT } from "./constants";
import type { UserSubscription } from "./auth-context";

/**
 * Returns the number of recipes the signed-in user has saved in Supabase.
 * Uses a COUNT query rather than fetching full rows for efficiency.
 */
export async function getRecipeCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * Returns true if the subscription is active (paid and not expired).
 * A `null` subscription is treated as free / inactive.
 */
export function hasActiveSubscription(sub: UserSubscription | null): boolean {
  if (!sub) return false;
  if (sub.plan === "free") return false;
  if (sub.status !== "active") return false;
  // If there's an expiry date, make sure it's in the future
  if (sub.current_period_end) {
    return new Date(sub.current_period_end) > new Date();
  }
  return true;
}

/**
 * Returns true if the user is allowed to create another recipe.
 *
 * Paid subscribers always can. Free users can only if they have fewer than
 * FREE_RECIPE_LIMIT recipes saved.
 */
export async function canCreateRecipe(
  subscription: UserSubscription | null
): Promise<boolean> {
  if (hasActiveSubscription(subscription)) return true;
  const count = await getRecipeCount();
  return count < FREE_RECIPE_LIMIT;
}

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Verifies the incoming request has a valid Supabase session.
 *
 * Usage in any API route:
 *   const auth = await requireAuth();
 *   if (auth instanceof Response) return auth;   // returns 401 to the caller
 *   const { user } = auth;                       // typed User object
 */
export async function requireAuth(): Promise<{ user: User } | Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user };
}

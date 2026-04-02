/**
 * Supabase client using the service-role key.
 *
 * This bypasses Row Level Security and should ONLY be used in trusted
 * server-side contexts where there is no user session — primarily the
 * Stripe webhook handler.
 *
 * Never import this from Client Components or from routes that have a
 * user session; use `lib/supabase/server.ts` (cookie-based) instead.
 */

import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback handler.
 *
 * Supabase redirects here after:
 * - Email confirmation (type=signup)  → exchange code → redirect to /
 * - Password reset link (type=recovery) → exchange code → redirect to /auth/reset-password
 *
 * The ?code= param is a one-time PKCE code that must be exchanged for a session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset: send to the reset-password page where they set a new password
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      // All other confirmations (sign-up email): send to the app
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // Something went wrong — send back to sign-in with an error message
  return NextResponse.redirect(
    `${origin}/auth/sign-in?error=Could not confirm your account. The link may have expired.`
  );
}

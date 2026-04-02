import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js proxy — runs on every matched request.
 * (Renamed from middleware.ts in Next.js 16)
 *
 * Two responsibilities:
 * 1. Refresh the Supabase session cookie (keeps the user logged in across
 *    tab switches, page reloads, and long sessions).
 * 2. Redirect unauthenticated users away from protected routes to /auth/sign-in.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove, required for session persistence
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");

  // Stripe webhook must be reachable without a session cookie
  const isPublicApiRoute = pathname === "/api/stripe/webhook";

  // Redirect unauthenticated users to sign-in (except on auth routes and public API routes)
  if (!user && !isAuthRoute && !isPublicApiRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/sign-in";
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages to the home page.
  // Exceptions: /auth/callback (exchanges the code) and /auth/reset-password
  // (the user must be authenticated to set a new password after clicking the link).
  if (
    user &&
    isAuthRoute &&
    pathname !== "/auth/callback" &&
    pathname !== "/auth/reset-password"
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

/**
 * Base URL for all API calls.
 *
 * - Web (Vercel): NEXT_PUBLIC_API_BASE_URL is unset → empty string → relative URLs work.
 * - Mobile (Capacitor static export): set NEXT_PUBLIC_API_BASE_URL=https://recipe-keeper-eta.vercel.app
 *   so the app calls the hosted API from inside the WebView.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

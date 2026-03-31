"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        // After the user clicks the link, Supabase redirects to /auth/callback
        // which exchanges the code and then sends them to /auth/reset-password.
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message || "Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 w-full max-w-sm text-center">
          <p className="text-4xl mb-3">📬</p>
          <h1 className="text-2xl font-bold text-amber-900 mb-2">Check your email</h1>
          <p className="text-stone-500 text-sm mb-6">
            We&apos;ve sent a password reset link to{" "}
            <span className="font-medium text-stone-700">{email}</span>. Click
            the link in the email to set a new password.
          </p>
          <p className="text-xs text-stone-400">
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <button
              onClick={() => setSubmitted(false)}
              className="text-amber-700 hover:underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-2xl mb-1">🔑</p>
          <h1 className="text-2xl font-bold text-amber-900">Forgot password?</h1>
          <p className="text-stone-500 text-sm mt-1">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium text-stone-700 mb-1"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="you@example.com"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 mt-6">
          Remember your password?{" "}
          <Link href="/auth/sign-in" className="text-amber-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

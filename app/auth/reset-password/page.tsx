"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrors({ general: "Could not update your password. The reset link may have expired. Please request a new one." });
    } else {
      // Password updated — redirect home (user is already signed in)
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-2xl mb-1">🔒</p>
          <h1 className="text-2xl font-bold text-amber-900">Set new password</h1>
          <p className="text-stone-500 text-sm mt-1">Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* New password */}
          <div>
            <label
              className="block text-sm font-medium text-stone-700 mb-1"
              htmlFor="password"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label
              className="block text-sm font-medium text-stone-700 mb-1"
              htmlFor="confirmPassword"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Re-enter your password"
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* General error */}
          {errors.general && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.general}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

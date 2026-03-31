"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  first_name: string;
  tutorial_completed: boolean;
  created_at: string;
}

export interface UserSubscription {
  plan: "free" | "monthly" | "annual";
  status: "active" | "canceled" | "past_due";
  current_period_end: string | null;
}

interface AuthContextValue {
  /** The raw Supabase auth user (null if not signed in) */
  user: User | null;
  /** The app-level profile row (null until loaded or if not signed in) */
  profile: UserProfile | null;
  /** The subscription row (null until loaded or if not signed in) */
  subscription: UserSubscription | null;
  /** True while auth state is being determined on first load */
  loading: boolean;
  /** Re-fetch profile + subscription from Supabase (e.g. after editing name) */
  refreshProfile: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  subscription: null,
  loading: true,
  refreshProfile: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndSubscription = useCallback(async (userId: string) => {
    const [profileRes, subRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", userId).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as UserProfile);
    if (subRes.data) setSubscription(subRes.data as UserSubscription);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfileAndSubscription(user.id);
  }, [user, fetchProfileAndSubscription]);

  useEffect(() => {
    // Hydrate auth state on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchProfileAndSubscription(user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Keep auth state in sync when the session changes
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          fetchProfileAndSubscription(nextUser.id);
        } else {
          setProfile(null);
          setSubscription(null);
        }
      }
    );

    return () => authListener.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, profile, subscription, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access auth state anywhere in the app.
 * Must be used inside a component wrapped by <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

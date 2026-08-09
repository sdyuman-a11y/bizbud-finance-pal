import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; display_name: string | null; avatar_url: string | null; email: string | null };

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  authOpen: false,
  setAuthOpen: () => {},
});

const DISMISS_KEY = "biz-bud.auth-prompt-dismissed";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpenState] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) setAuthOpenState(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (!data.session && !window.sessionStorage.getItem(DISMISS_KEY)) {
        setAuthOpenState(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, email")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as Profile) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      authOpen,
      setAuthOpen: (open: boolean) => {
        if (!open) window.sessionStorage.setItem(DISMISS_KEY, "1");
        setAuthOpenState(open);
      },
    }),
    [session, profile, loading, authOpen],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  client_type: string | null;
  company: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, client_type, company, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
    // Grants the owner account its admin role on first sign-in; returns the role for anyone.
    const { data: admin } = await supabase.rpc("claim_admin_role");
    setIsAdmin(Boolean(admin));
  }, []);

  useEffect(() => {
    // Register the listener first, then hydrate the existing session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Signing out anywhere clears the deep research journal kept in this browser (the
      // privacy page promises it); a dynamic import keeps journal.ts out of the auth bundle.
      if (_event === "SIGNED_OUT")
        void import("@/components/deep/journal")
          .then((j) => j.clearJournal(j.browserStorage()))
          .catch(() => undefined);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // Defer Supabase call to avoid deadlock inside the callback.
        setTimeout(() => loadProfile(nextSession.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfile(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const value = useMemo(
    () => ({ session, user, profile, loading, isAdmin, signOut, refreshProfile }),
    [session, user, profile, loading, isAdmin, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

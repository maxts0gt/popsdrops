import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { MobileRole, MobileStatus } from "./access-policy";
import {
  completeMobileAuthSession,
  getMobileAuthRedirectUrl,
} from "./mobile-auth";

WebBrowser.maybeCompleteAuthSession();

type Profile = {
  id: string;
  role: MobileRole;
  full_name: string | null;
  avatar_url: string | null;
  status: MobileStatus;
  preferred_locale: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileReady: boolean;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, avatar_url, status, preferred_locale")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      setSession(session);

      if (session?.user) {
        setProfileReady(false);
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }

      if (!cancelled) {
        setProfileReady(true);
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (cancelled) {
          return;
        }

        setSession(session);

        if (session?.user) {
          setProfileReady(false);
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        if (!cancelled) {
          setProfileReady(true);
          setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = getMobileAuthRedirectUrl(Linking.createURL);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error.message);
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === "success" && result.url) {
        const completion = await completeMobileAuthSession(
          result.url,
          (session) => supabase.auth.setSession(session),
        );

        if (completion.kind === "error") {
          console.error("Google sign-in callback error:", completion.message);
        }
      }
    }
  }, []);

  async function refreshProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    setProfileReady(false);
    await fetchProfile(session.user.id);
    setProfileReady(true);
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        profileReady,
        signInWithGoogle,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

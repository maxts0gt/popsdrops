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

WebBrowser.maybeCompleteAuthSession();

type Profile = {
  id: string;
  role: "creator" | "brand" | "admin";
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, avatar_url, status")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = Linking.createURL("auth/callback");

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
        // Extract tokens from the URL fragment (#access_token=...&refresh_token=...)
        const hashIndex = result.url.indexOf("#");
        const fragment = hashIndex >= 0 ? result.url.slice(hashIndex + 1) : "";
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    }
  }, []);

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
        signInWithGoogle,
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

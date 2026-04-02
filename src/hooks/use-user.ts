"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  role: "creator" | "brand" | "admin";
  full_name: string;
  avatar_url: string | null;
  email: string;
  status: string;
}

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data as UserProfile);
      setLoading(false);
    }

    load();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { profile, loading };
}

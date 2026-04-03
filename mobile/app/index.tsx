import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { decideMobileAccess } from "../lib/access-policy";
import { AccessStateScreen } from "../components/access-state-screen";
import { WaitlistScreen } from "../components/waitlist-screen";

export default function Index() {
  const { session, profile, loading, profileReady } = useAuth();
  const access = decideMobileAccess({
    loading,
    hasSession: !!session,
    profileReady,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
  });

  if (access.kind === "loading") {
    return <AccessStateScreen mode="loading" />;
  }

  if (access.kind === "blocked") {
    if (access.reason === "invitation_required") {
      return <WaitlistScreen />;
    }
    return <AccessStateScreen mode={access.reason} />;
  }

  return <Redirect href={access.href} />;
}

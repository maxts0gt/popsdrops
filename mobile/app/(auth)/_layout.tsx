import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../../lib/auth";

export default function AuthLayout() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </>
  );
}

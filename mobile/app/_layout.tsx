import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { I18nProvider, useI18n } from "../lib/i18n";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { ready } = useI18n();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, ready]);

  // Hold splash screen until fonts AND translations are loaded
  if (!fontsLoaded || !ready) return null;

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

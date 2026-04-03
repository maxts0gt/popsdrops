import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
import { isAppShellReady } from "../lib/app-shell";
import { ThemeProvider, useTheme } from "../lib/theme-context";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { ready, isLoadingLocale, isRTL, t } = useI18n();
  const { statusBarStyle, ready: themeReady, palette } = useTheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontFallbackElapsed, setFontFallbackElapsed] = useState(false);
  const appShellReady = isAppShellReady({
    fontsLoaded,
    fontFallbackElapsed,
    themeReady,
    localeReady: ready,
  });

  useEffect(() => {
    if (fontsLoaded) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setFontFallbackElapsed(true);
    }, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fontsLoaded]);

  useEffect(() => {
    if (appShellReady) {
      void SplashScreen.hideAsync();
    }
  }, [appShellReady]);

  if (!appShellReady) {
    return null;
  }

  return (
    <AuthProvider>
      <View
        className="flex-1"
        style={{ backgroundColor: palette.background, direction: isRTL ? "rtl" : "ltr" }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="edit-profile"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="preferences"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="select-language"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="campaign/[id]"
            options={{ presentation: "modal" }}
          />
        </Stack>
        {isLoadingLocale ? (
          <View
            className="absolute inset-0 items-center justify-center"
            pointerEvents="auto"
            style={{ backgroundColor: `${palette.background}F2` }}
          >
            <ActivityIndicator size="large" color={palette.textPrimary} />
            <Text
              className="mt-4 text-base"
              style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
            >
              {t("preferences.languageLoading")}
            </Text>
          </View>
        ) : null}
        <StatusBar style={statusBarStyle} />
      </View>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppContent />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

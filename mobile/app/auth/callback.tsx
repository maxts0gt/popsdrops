import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../../lib/i18n";
import { completeMobileAuthSession } from "../../lib/mobile-auth";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme-context";

export default function AuthCallbackScreen() {
  const { t } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const callbackUrl = Linking.useURL();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const initialUrl = callbackUrl ?? (await Linking.getInitialURL());

      if (!initialUrl) {
        if (!cancelled) {
          setErrorMessage(t("auth.signInFailedDetail"));
        }
        return;
      }

      const completion = await completeMobileAuthSession(
        initialUrl,
        (session) => supabase.auth.setSession(session),
      );

      if (cancelled) {
        return;
      }

      if (completion.kind === "success") {
        router.replace("/");
        return;
      }

      if (completion.kind === "error") {
        setErrorMessage(completion.message);
        return;
      }

      setErrorMessage(t("auth.signInFailedDetail"));
    })();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, router, t]);

  if (!errorMessage) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }}>
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color={palette.textPrimary} />
          <Text
            className="mt-5 text-base"
            style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
          >
            {t("auth.completingSignIn")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }}>
      <View className="flex-1 justify-center px-6">
        <View
          className="rounded-[28px] border px-6 py-8"
          style={{ backgroundColor: palette.surfaceMuted, borderColor: palette.border }}
        >
          <Text
            className="text-2xl"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {t("auth.signInFailed")}
          </Text>
          <Text
            className="mt-3 text-base leading-6"
            style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
          >
            {errorMessage}
          </Text>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            className="mt-8 items-center rounded-xl px-6 py-4"
            style={{ backgroundColor: palette.buttonPrimaryBackground }}
          >
            <Text
              className="text-sm"
              style={{
                color: palette.buttonPrimaryText,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("auth.returnToLogin")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
